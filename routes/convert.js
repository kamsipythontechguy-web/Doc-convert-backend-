const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  convertToPdf,
  mergePdfs,
  splitPdf,
  compressPdf
} = require("../services/converter");

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
const OUTPUT_DIR = path.join(__dirname, "..", "outputs");

const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 25);
const MAX_FILE_SIZE = MAX_FILE_MB * 1024 * 1024;

const allowedExtensions = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp"
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const safeBase = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 80);

    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    cb(null, `${unique}-${safeBase}${path.extname(file.originalname).toLowerCase()}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 20
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.has(ext)) {
      return cb(new Error(`Unsupported file type: ${ext || "unknown"}`));
    }

    cb(null, true);
  }
});

function cleanup(files = []) {
  for (const file of files) {
    try {
      fs.unlinkSync(file.path);
    } catch {}
  }
}

function cleanupOutput(filePath) {
  if (!filePath) return;

  setTimeout(() => {
    try {
      fs.unlinkSync(filePath);
    } catch {}
  }, 10 * 60 * 1000);
}

function outputName(original, extension, prefix = "") {
  const base = path
    .basename(original, path.extname(original))
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 80);

  return `${prefix}${base || "converted"}.${extension}`;
}

router.post(
  "/to-pdf",
  upload.single("file"),
  async (req, res) => {
    const files = req.file ? [req.file] : [];

    try {
      if (!req.file) {
        return res.status(400).json({
          ok: false,
          error: "No file uploaded."
        });
      }

      const outputPath = await convertToPdf(
        req.file.path,
        OUTPUT_DIR
      );

      const ext = path.extname(outputPath).slice(1);

      res.download(
        outputPath,
        outputName(req.file.originalname, ext),
        err => {
          cleanup(files);
          cleanupOutput(outputPath);

          if (err) {
            console.error(err);
          }
        }
      );
    } catch (error) {
      cleanup(files);

      res.status(400).json({
        ok: false,
        error: error.message
      });
    }
  }
);

router.post(
  "/merge",
  upload.array("files", 20),
  async (req, res) => {
    const files = req.files || [];

    try {
      if (files.length < 2) {
        return res.status(400).json({
          ok: false,
          error: "Upload at least two PDF files."
        });
      }

      const outputPath = await mergePdfs(
        files.map(file => file.path),
        OUTPUT_DIR
      );

      res.download(
        outputPath,
        "merged-document.pdf",
        err => {
          cleanup(files);
          cleanupOutput(outputPath);

          if (err) console.error(err);
        }
      );
    } catch (error) {
      cleanup(files);

      res.status(400).json({
        ok: false,
        error: error.message
      });
    }
  }
);

router.post(
  "/split",
  upload.single("file"),
  async (req, res) => {
    const files = req.file ? [req.file] : [];

    try {
      if (!req.file) {
        return res.status(400).json({
          ok: false,
          error: "No PDF uploaded."
        });
      }

      const page = Number(req.body.page || 1);

      if (!Number.isInteger(page) || page < 1) {
        return res.status(400).json({
          ok: false,
          error: "Page must be a positive integer."
        });
      }

      const outputPath = await splitPdf(
        req.file.path,
        page,
        OUTPUT_DIR
      );

      res.download(
        outputPath,
        `split-page-${page}.pdf`,
        err => {
          cleanup(files);
          cleanupOutput(outputPath);

          if (err) console.error(err);
        }
      );
    } catch (error) {
      cleanup(files);

      res.status(400).json({
        ok: false,
        error: error.message
      });
    }
  }
);

router.post(
  "/compress",
  upload.single("file"),
  async (req, res) => {
    const files = req.file ? [req.file] : [];

    try {
      if (!req.file) {
        return res.status(400).json({
          ok: false,
          error: "No PDF uploaded."
        });
      }

      const outputPath = await compressPdf(
        req.file.path,
        OUTPUT_DIR
      );

      res.download(
        outputPath,
        "compressed-document.pdf",
        err => {
          cleanup(files);
          cleanupOutput(outputPath);

          if (err) console.error(err);
        }
      );
    } catch (error) {
      cleanup(files);

      res.status(400).json({
        ok: false,
        error: error.message
      });
    }
  }
);

module.exports = router;
