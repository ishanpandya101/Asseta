require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

/* ================= DATABASE ================= */

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

/* ================= MODELS ================= */

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

const User = mongoose.model(
  "User",
  new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    role: { type: String, default: "user" },
    email: String,
    password: { type: String, required: true },
  })
);

const Notification = mongoose.model(
  "Notification",
  new mongoose.Schema({
    title: String,
    message: String,
    type: { type: String, default: "info" },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  })
);

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

const RecycleBin = mongoose.model(
  "RecycleBin",
  new mongoose.Schema({
    entityType: String,
    data: Object,
    deletedAt: { type: Date, default: Date.now },
  })
);

/* ================= HELPERS ================= */

async function createNotification(title, message, type = "info") {
  try {
    await Notification.create({ title, message, type });
  } catch (err) {
    console.error("Notification error:", err);
  }
}

/* ================= CRUD ================= */

function crudRoutes(model, name) {
  const base = `/api/${name}`;

  // GET
  app.get(base, async (req, res) => {
    const data = await model.find();
    res.json(data);
  });

  // POST
  app.post(base, async (req, res) => {
    const item = await model.create(req.body);

    await createNotification(
      `${name} Added`,
      `${name} created successfully`,
      "success"
    );

    res.json(item);
  });

  // PUT
  app.put(`${base}/:id`, async (req, res) => {
    const updated = await model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    res.json(updated);
  });

  // DELETE
  app.delete(`${base}/:id`, async (req, res) => {
    const item = await model.findById(req.params.id);

    if (item) {
      await RecycleBin.create({
        entityType: name,
        data: item,
      });
    }

    await model.findByIdAndDelete(req.params.id);

    res.json({ success: true });
  });
}

/* ================= ROUTES ================= */

crudRoutes(Vendor, "vendors");
crudRoutes(Product, "products");
crudRoutes(Asset, "assets");
crudRoutes(User, "users");

/* ============ AUTH ============ */

app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body;

  const hash = await bcrypt.hash(password, 10);

  await User.create({
    username,
    password: hash,
  });

  res.json({ message: "Registered Successfully" });
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });

  if (!user) return res.status(400).json({ message: "User not found" });

  const ok = await bcrypt.compare(password, user.password);

  if (!ok) return res.status(400).json({ message: "Wrong password" });

  res.json({ message: "Login Success" });
});

/* ============ TEST ROUTE ============ */

app.get("/", (req, res) => {
  res.send("Asseta Backend Running 🚀");
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
