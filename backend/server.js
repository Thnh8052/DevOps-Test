require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB Error:", err));

const cleanData = (data) => {
  const clean = {};
  if (data.name) clean.name = data.name.trim();
  if (data.email) clean.email = data.email.trim();
  if (data.address) clean.address = data.address.trim();
  if (data.age !== undefined && data.age !== "")
    clean.age = parseInt(data.age);
  return clean;
};

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Tên không được để trống"],
    minlength: [2, "Tên phải có ít nhất 2 ký tự"],
  },
  age: {
    type: Number,
    required: [true, "Tuổi không được để trống"],
    min: [0, "Tuổi phải >= 0"],
  },
  email: {
    type: String,
    required: [true, "Email không được để trống"],
    match: [/^\S+@\S+\.\S+$/, "Email không hợp lệ"],
    unique: true,
  },
  address: {
    type: String,
  },
});

const User = mongoose.model("User", UserSchema);

app.get("/", (req, res) => {
  res.send("Backend is running on Render");
});

// GET /api/users
app.get("/api/users", async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 5;

    if (page < 1) page = 1;
    if (limit < 1) limit = 5;
    if (limit > 10) limit = 10;

    const search = req.query.search || "";

    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { address: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(filter).sort({ _id: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: users,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users
app.post("/api/users", async (req, res) => {
  try {
    const raw = cleanData(req.body);

    if (raw.email) {
      const existed = await User.findOne({ email: raw.email });
      if (existed) {
        return res
          .status(400)
          .json({ error: "Email này đã tồn tại trong hệ thống!" });
      }
    }

    const newUser = await User.create(raw);
    res.status(201).json({
      message: "Tạo người dùng thành công",
      data: newUser,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ error: "Email này đã tồn tại trong hệ thống!" });
    }
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/users/:id
app.put("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID không hợp lệ" });
    }

    const updateData = cleanData(req.body);

    if (updateData.email) {
      const existed = await User.findOne({ email: updateData.email });
      if (existed && existed._id.toString() !== id) {
        return res
          .status(400)
          .json({ error: "Email này đã tồn tại trong hệ thống!" });
      }
    }

    const updated = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    res.json({
      message: "Cập nhật thành công",
      data: updated,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/users/:id
app.delete("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    res.json({ message: "Xóa người dùng thành công" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
