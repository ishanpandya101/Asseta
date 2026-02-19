// ======= server.js =======
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

app.use(express.static("public"));

// ======= ROOT ROUTE (FIXED) =======
app.get("/", (req, res) => {
  res.send("🚀 Asseta Backend is Live on Railway!");
});

// ======= DATABASE CONNECTION (FIXED) =======
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ Mongo error:", err));

// ======= MODELS =======

// --- Vendor ---
const Vendor = mongoose.model(
  "Vendor",
  new mongoose.Schema({
    name: { type: String, required: true },
    email: String,
    phone: String,
    company: String,
    logo: String,
  })
);

// --- Product ---
const Product = mongoose.model(
  "Product",
  new mongoose.Schema({
    name: { type: String, required: true },
    category: String,
    price: Number,
    vendor: String,
    quantity: Number,
  })
);

// --- User ---
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  role: { type: String, default: "user" },
  email: String,
  password: { type: String, required: true },
});
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});
const User = mongoose.model("User", userSchema);

// --- Asset ---
const Asset = mongoose.model(
  "Asset",
  new mongoose.Schema({
    name: { type: String, required: true },
    type: String,
    assignedTo: String,
    status: String,
    purchaseDate: Date,
  })
);

// --- Recycle Bin ---
const RecycleBin = mongoose.model(
  "RecycleBin",
  new mongoose.Schema({
    entityType: String,
    data: Object,
    deletedAt: { type: Date, default: Date.now },
  })
);

// --- Notification ---
const Notification = mongoose.model(
  "Notification",
  new mongoose.Schema({
    title: { type: String, required: true },
    message: String,
    type: { type: String, default: "info" },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  })
);

// --- Support ---
const Support = mongoose.model(
  "Support",
  new mongoose.Schema({
    name: String,
    email: String,
    subject: String,
    message: String,
    status: { type: String, default: "open" },
    createdAt: { type: Date, default: Date.now },
  })
);

// ======= HELPERS =======
async function logToRecycleBin(entityType, data) {
  try {
    await RecycleBin.create({ entityType, data });
  } catch (err) {
    console.error("♻️ RecycleBin error:", err.message);
  }
}

async function createNotification(title, message, type = "info") {
  try {
    await Notification.create({ title, message, type });
  } catch (err) {
    console.error("🔔 Notification error:", err.message);
  }
}

// ======= GENERIC CRUD ROUTES FUNCTION =======
function crudRoutes(model, name, options = {}) {
  const base = `/api/${name}`;

  // GET all
  app.get(base, async (req, res) => {
    try {
      const data = await model.find();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET one
  app.get(`${base}/:id`, async (req, res) => {
    try {
      const data = await model.findById(req.params.id);
      if (!data) return res.status(404).json({ message: `${name} not found` });
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // CREATE
  app.post(base, async (req, res) => {
    try {
      let payload = req.body;

      // Hash password for users
      if (options.hashPassword && payload.password) {
        const salt = await bcrypt.genSalt(10);
        payload.password = await bcrypt.hash(payload.password, salt);
      }

      const item = new model(payload);
      await item.save();

      await createNotification(
        `${name.slice(0, -1)} Added`,
        `${name.slice(0, -1)} created successfully.`,
        "success"
      );

      res.status(201).json(item);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });

  // UPDATE
  app.put(`${base}/:id`, async (req, res) => {
    try {
      let payload = req.body;
      if (options.hashPassword && payload.password) {
        const salt = await bcrypt.genSalt(10);
        payload.password = await bcrypt.hash(payload.password, salt);
      }

      const updated = await model.findByIdAndUpdate(req.params.id, payload, {
        new: true,
      });
      if (!updated) return res.status(404).json({ message: `${name} not found` });

      await createNotification(
        `${name.slice(0, -1)} Updated`,
        `${name.slice(0, -1)} updated successfully.`,
        "info"
      );

      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });

  // DELETE (log to recycle bin)
  app.delete(`${base}/:id`, async (req, res) => {
    try {
      const existing = await model.findById(req.params.id);
      if (existing) await logToRecycleBin(name.slice(0, -1), existing);

      await model.findByIdAndDelete(req.params.id);

      await createNotification(
        `${name.slice(0, -1)} Deleted`,
        `${name.slice(0, -1)} moved to recycle bin.`,
        "warning"
      );

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
}

// ======= REGISTER CRUD ROUTES =======
crudRoutes(Vendor, "vendors");
crudRoutes(Product, "products");
crudRoutes(Asset, "assets");
crudRoutes(User, "users", { hashPassword: true });

// ======= RECYCLE BIN ROUTES =======
app.get("/api/recycle-bin", async (req, res) => {
  const items = await RecycleBin.find().sort({ deletedAt: -1 });
  res.json(items);
});
app.delete("/api/recycle-bin/:id", async (req, res) => {
  await RecycleBin.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});
app.delete("/api/recycle-bin", async (req, res) => {
  await RecycleBin.deleteMany({});
  res.json({ success: true, message: "Recycle bin emptied" });
});

// ======= NOTIFICATIONS ROUTES =======
app.get("/api/notifications", async (req, res) => {
  const notes = await Notification.find().sort({ createdAt: -1 });
  res.json(notes);
});
app.put("/api/notifications/:id/read", async (req, res) => {
  const updated = await Notification.findByIdAndUpdate(
    req.params.id,
    { isRead: true },
    { new: true }
  );
  res.json(updated);
});
app.delete("/api/notifications/:id", async (req, res) => {
  await Notification.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// ======= SUPPORT ROUTES =======
app.get("/api/support", async (req, res) => {
  const tickets = await Support.find().sort({ createdAt: -1 });
  res.json(tickets);
});
app.post("/api/support", async (req, res) => {
  const ticket = new Support(req.body);
  await ticket.save();
  await createNotification(
    "New Support Ticket",
    `Ticket from ${ticket.name}`,
    "info"
  );
  res.json(ticket);
});
app.put("/api/support/:id", async (req, res) => {
  const updated = await Support.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  res.json(updated);
});
app.delete("/api/support/:id", async (req, res) => {
  await Support.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// ======= LOGIN ROUTE =======
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ======= START SERVER (FIXED) =======
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
