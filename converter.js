const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { promisify } = require("util");
const {
  PDFDocument,
  StandardFonts,
  rgb
} = require("pdf-lib");

const execFileAsync = promisify(execFile);

function uniqueOutput(dir, extension) {
  const id = crypto.randomBytes(8).toString("hex");
  return path.join(dir, `docconvert-${Date.now()}-${id}.${extension}`);
}

function ensurePdf(filePath) {
  if (path.extname(filePath).toLowerCase() !== ".pdf") {
    throw new Error("This operation requires a PDF file.");
  }
}

async function convertWithLibreOffice(inputPath, outputDir) {
  const ext = path.extname(inputPath).toLowerCase();

  const officeTypes = new Set([
    ".doc",
    ".docx",
    ".ppt",
    ".pptx",
    ".xls",
    ".xlsx",
    ".csv"
  ]);

  if (!officeTypes.has(ext)) {
    throw new Error("LibreOffice conversion is not supported for this file type.");
  }

  await execFileAsync(
    "libreoffice",
    [
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      outputDir,
      inputPath
    ],
    {
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024
    }
  );

  const expected = path.join(
    outputDir,
    `${path.basename(inputPath, ext)}.pdf`
  );

  if (!fs.existsSync(expected)) {
    throw new Error("LibreOffice did not create the PDF output.");
  }

  return expected;
}

async function textToPdf(inputPath, outputDir) {
  const text = fs.readFileSync(inputPath, "utf8");
  const outputPath = uniqueOutput(outputDir, "pdf");

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 48;
  const fontSize = 11;
  const lineHeight = 16;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  for (const line of lines) {
    const chunks = line.match(/.{1,95}/g) || [""];

    for (const chunk of chunks) {
      if (y < margin + lineHeight) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }

      page.drawText(chunk, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0.1, 0.1, 0.1)
      });

      y -= lineHeight;
    }
  }

  fs.writeFileSync(
    outputPath,
    await pdf.save()
  );

  return outputPath;
}

async function imageToPdf(inputPath, outputDir) {
  const ext = path.extname(inputPath).toLowerCase();
  const bytes = fs.readFileSync(inputPath);

  const pdf = await PDFDocument.create();

  let image;

  if (ext === ".jpg" || ext === ".jpeg") {
    image = await pdf.embedJpg(bytes);
  } else if (ext === ".png") {
    image = await pdf.embedPng(bytes);
  } else {
    throw new Error("WebP images are not supported by the PDF engine yet. Convert the image to PNG or JPG first.");
  }

  const imageWidth = image.width;
  const imageHeight = image.height;

  const maxWidth = 520;
  const maxHeight = 740;

  const scale = Math.min(
    maxWidth / imageWidth,
    maxHeight / imageHeight,
    1
  );

  const width = imageWidth * scale;
  const height = imageHeight * scale;

  const page = pdf.addPage([595.28, 841.89]);

  page.drawImage(image, {
    x: (595.28 - width) / 2,
    y: (841.89 - height) / 2,
    width,
    height
  });

  const outputPath = uniqueOutput(outputDir, "pdf");

  fs.writeFileSync(
    outputPath,
    await pdf.save()
  );

  return outputPath;
}

async function convertToPdf(inputPath, outputDir) {
  const ext = path.extname(inputPath).toLowerCase();

  if (ext === ".pdf") {
    const outputPath = uniqueOutput(outputDir, "pdf");
    fs.copyFileSync(inputPath, outputPath);
    return outputPath;
  }

  if (ext === ".txt") {
    return textToPdf(inputPath, outputDir);
  }

  if (
    ext === ".jpg" ||
    ext === ".jpeg" ||
    ext === ".png"
  ) {
    return imageToPdf(inputPath, outputDir);
  }

  if (
    [
      ".doc",
      ".docx",
      ".ppt",
      ".pptx",
      ".xls",
      ".xlsx",
      ".csv"
    ].includes(ext)
  ) {
    return convertWithLibreOffice(
      inputPath,
      outputDir
    );
  }

  throw new Error(
    "This file type cannot be converted to PDF yet."
  );
}

async function mergePdfs(inputPaths, outputDir) {
  const merged = await PDFDocument.create();

  for (const inputPath of inputPaths) {
    ensurePdf(inputPath);

    const sourceBytes =
      fs.readFileSync(inputPath);

    const source =
      await PDFDocument.load(sourceBytes);

    const pages =
      await merged.copyPages(
        source,
        source.getPageIndices()
      );

    pages.forEach(page => {
      merged.addPage(page);
    });
  }

  const outputPath =
    uniqueOutput(outputDir, "pdf");

  fs.writeFileSync(
    outputPath,
    await merged.save()
  );

  return outputPath;
}

async function splitPdf(
  inputPath,
  pageNumber,
  outputDir
) {
  ensurePdf(inputPath);

  const source =
    await PDFDocument.load(
      fs.readFileSync(inputPath)
    );

  const index = pageNumber - 1;

  if (
    index < 0 ||
    index >= source.getPageCount()
  ) {
    throw new Error(
      `PDF has ${source.getPageCount()} page(s). Page ${pageNumber} does not exist.`
    );
  }

  const output =
    await PDFDocument.create();

  const [page] =
    await output.copyPages(
      source,
      [index]
    );

  output.addPage(page);

  const outputPath =
    uniqueOutput(outputDir, "pdf");

  fs.writeFileSync(
    outputPath,
    await output.save()
  );

  return outputPath;
}

async function compressPdf(inputPath, outputDir) {
  ensurePdf(inputPath);

  const outputPath =
    uniqueOutput(outputDir, "pdf");

  await execFileAsync(
    "qpdf",
    [
      "--linearize",
      "--object-streams=generate",
      inputPath,
      outputPath
    ],
    {
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024
    }
  );

  if (!fs.existsSync(outputPath)) {
    throw new Error("PDF compression failed.");
  }

  return outputPath;
}

module.exports = {
  convertToPdf,
  mergePdfs,
  splitPdf,
  compressPdf
};