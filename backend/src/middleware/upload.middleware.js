const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ApiError = require("../utils/ApiError");

const UPLOAD_DIR = process.env.UPLOAD_PATH
  ? path.resolve(process.env.UPLOAD_PATH)
  : path.resolve(process.cwd(), "uploads");

console.log("📁 Upload directory:", UPLOAD_DIR);

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log("📂 Created directory:", dir);
  }
};

ensureDir(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const folder = req.uploadFolder || "misc";

      const uploadPath = path.join(UPLOAD_DIR, folder);

      ensureDir(uploadPath);

      console.log("📤 Saving file to:", uploadPath);

      cb(null, uploadPath);
    } catch (error) {
      console.error("❌ Upload directory error:", error);
      cb(error);
    }
  },

  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

    const extension = path.extname(file.originalname);

    const filename = `${file.fieldname}-${uniqueSuffix}${extension}`;

    console.log("📝 Upload filename:", filename);

    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/png", "image/webp"];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, "Only JPEG, PNG, and WEBP images are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024,
  },
});

module.exports = upload;

module.exports.UPLOAD_DIR = UPLOAD_DIR;
