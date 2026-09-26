const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const convertRouter = require("./routes/convert");

const app = express();
const PORT = Number(process.env.PORT || 8080);

const UPLOAD_DIR = path.join(__dirname, "uploads");
const OUTPUT_DIR = path.join(__dirname, "outputs");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

app.disable("x-powered-by");

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json({ limit: "1mb" }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

app.use("/api/", limiter);

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "DocConvert API",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/convert", convertRouter);

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Route not found"
  });
});

app.use((err, req, res, next) => {
  console.error(err);

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      ok: false,
      error: "File is too large."
    });
  }

  res.status(500).json({
    ok: false,
    error: "Unexpected server error."
  });
});

app.listen(PORT, () => {
  console.log(`DocConvert API running on port ${PORT}`);
});