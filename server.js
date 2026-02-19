<<<<<<< HEAD
// ======= server.js =======
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));
app.use(express.static("public"));

// ======= DATABASE CONNECTION =======
mongoose
  .connect("mongodb://127.0.0.1:27017/Asseta", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ Mongo error:", err));

// ======= MODELS =======
const Vendor = mongoose.model("Vendor", new mongoose.Schema({
  name: { type: String, required: true },
  email: String,
  phone: String,
  company: String,
  logo: String,
}));

const Product = mongoose.model("Product", new mongoose.Schema({
  name: { type: String, required: true },
  category: String,
  price: Number,
  vendor: String,
  quantity: Number,
}));

const Asset = mongoose.model("Asset", new mongoose.Schema({
  name: { type: String, required: true },
  type: String,
  assignedTo: String,
  status: String,
  purchaseDate: Date,
}));

const User = mongoose.model("User", new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  role: { type: String, default: "user" },
  email: String,
  password: { type: String, required: true },
}));

const Notification = mongoose.model("Notification", new mongoose.Schema({
  title: String,
  message: String,
  type: { type: String, default: "info" },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}));

const RecycleBin = mongoose.model("RecycleBin", new mongoose.Schema({
  entityType: String,
  data: Object,
  deletedAt: { type: Date, default: Date.now },
}));

const Support = mongoose.model("Support", new mongoose.Schema({
  name: String,
  email: String,
  subject: String,
  message: String,
  category: { type: String, default: "General" },
  priority: { type: String, default: "Medium" },
  status: { type: String, default: "open" },
  adminReply: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}));

const ActivityLog = mongoose.model("ActivityLog", new mongoose.Schema({
  user: { type: String, default: "System" },
  action: String,
  entity: String,
  details: String,
  createdAt: { type: Date, default: Date.now },
}));

// ======= HELPERS =======
async function createNotification(title, message, type = "info") {
  try {
    await Notification.create({ title, message, type });
  } catch (err) {
    console.error("createNotification error:", err);
  }
}

async function logActivity(user, action, entity, details = "") {
  try {
    await ActivityLog.create({ user, action, entity, details });
  } catch (err) {
    console.error("logActivity error:", err);
  }
}

// ======= CRUD ROUTE HELPER =======
function crudRoutes(model, name) {
  const base = `/api/${name}`;

  // GET ALL
  app.get(base, async (req, res) => {
    try {
      const items = await model.find();
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // CREATE
  app.post(base, async (req, res) => {
    try {
      const item = await model.create(req.body);
      await createNotification(`${name} Added`, `${name} created successfully`, "success");
      await logActivity("Ishan Pandya", "CREATE", name, "Item created");
      res.json(item);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // UPDATE
  app.put(`${base}/:id`, async (req, res) => {
    try {
      const payload = { ...req.body, updatedAt: new Date() };
      const item = await model.findByIdAndUpdate(req.params.id, payload, { new: true });
      if (!item) return res.status(404).json({ message: `${name} not found` });
      await createNotification(`${name} Updated`, `${name} updated successfully`, "info");
      await logActivity("Ishan Pandya", "UPDATE", name, "Item updated");
      res.json(item);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE
  app.delete(`${base}/:id`, async (req, res) => {
    try {
      const item = await model.findById(req.params.id);
      if (!item) return res.status(404).json({ message: `${name} not found` });
      await RecycleBin.create({
        entityType: name,
        data: item.toObject(),
        deletedAt: new Date(),
      });
      await model.findByIdAndDelete(req.params.id);
      await createNotification(`${name} Deleted`, `${name} deleted successfully`, "warning");
      await logActivity("Ishan Pandya", "DELETE", name, "Item deleted and moved to recycle bin");
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
crudRoutes(User, "users");

// ======= SUPPORT =======
app.get("/api/support", async (req, res) => {
  try {
    const tickets = await Support.find().sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/support", async (req, res) => {
  try {
    const payload = {
      name: req.body.name,
      email: req.body.email,
      subject: req.body.subject,
      message: req.body.message,
      category: req.body.category || "General",
      priority: req.body.priority || "Medium",
      status: "open",
    };
    const ticket = await Support.create(payload);
    await createNotification("New Support Ticket", `Ticket: ${ticket.subject}`, "info");
    await logActivity(payload.name || "User", "CREATE", "Support", `Ticket created: ${ticket.subject}`);
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/support/:id", async (req, res) => {
  try {
    const updates = { ...req.body, updatedAt: new Date() };
    const updated = await Support.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!updated) return res.status(404).json({ message: "Ticket not found" });
    if (updates.status === "resolved")
      await createNotification("Ticket Resolved", `Resolved: ${updated.subject}`, "success");
    if (updates.adminReply)
      await createNotification("Support Reply", `Reply to: ${updated.subject}`, "info");
    await logActivity("Ishan Pandya", "UPDATE", "Support", `Updated ticket ${updated._id}`);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ======= NOTIFICATIONS =======
app.get("/api/notifications", async (req, res) => {
  try {
    const notes = await Notification.find().sort({ createdAt: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/notifications/:id/read", async (req, res) => {
  try {
    const updated = await Notification.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ TEST NOTIFICATION ROUTE
app.post("/api/test-notification", async (req, res) => {
  try {
    await Notification.create({
      title: "Test Notification",
      message: "This is a sample notification from server.js",
      type: "info",
    });
    res.json({ success: true, message: "Notification created" });
  } catch (err) {
    console.error("❌ Test notification error:", err);
    res.status(500).json({ message: "Failed to create test notification" });
  }
});

// ======= RECYCLE BIN =======
app.get("/api/recyclebin", async (req, res) => {
  try {
    const data = await RecycleBin.find().sort({ deletedAt: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ======= ACTIVITY LOG =======
app.get("/api/activity", async (req, res) => {
  try {
    const logs = await ActivityLog.find().sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ======= AUTH =======
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ message: "Username already exists" });
    const hashed = await bcrypt.hash(password, 10);
    await User.create({ username, email, password: hashed });
    await createNotification("New Registration", `${username} registered successfully`, "info");
    await logActivity(username, "REGISTER", "User", "New user account created");
    res.json({ message: "Registration successful!" });
  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ message: "Registration failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: "User not found" });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });
    await logActivity(username, "LOGIN", "User", "User logged in");
    res.json({ message: "Login successful", token: "mock-token-123" });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

// ======= START SERVER =======
app.listen(5000, () => console.log("🚀 Server running on http://localhost:5000"));
=======
// ======= server.js =======
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

app.use(express.static("public"));

// ======= DATABASE CONNECTION =======
mongoose
  .connect("mongodb://127.0.0.1:27017/Asseta", {
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

      const updated = await model.findByIdAndUpdate(req.params.id, payload, { new: true });
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
  const updated = await Notification.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
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
  await createNotification("New Support Ticket", `Ticket from ${ticket.name}`, "info");
  res.json(ticket);
});
app.put("/api/support/:id", async (req, res) => {
  const updated = await Support.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
});
app.delete("/api/support/:id", async (req, res) => {
  await Support.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// ======= START SERVER =======
const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

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
>>>>>>> 50aea049aa956861f822d7b541f9fa404ecece1d
