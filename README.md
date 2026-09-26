# DocConvert Backend

This is the real conversion API for the DocConvert frontend.

## Current real capabilities

- DOC/DOCX → PDF
- PPT/PPTX → PDF
- XLS/XLSX → PDF
- CSV → PDF
- TXT → PDF
- JPG/JPEG/PNG → PDF
- PDF → PDF passthrough
- Merge PDF
- Split PDF by page
- Compress PDF

## Not falsely implemented

PDF → editable DOCX/PPTX/XLSX is intentionally not claimed as fully supported in this first backend release. Those conversions require a more specialized document reconstruction pipeline and will be added as a separate advanced conversion layer.

## Run locally

Requirements:

- Node.js 20+
- LibreOffice
- qpdf

Then:

```bash
npm install
npm start
```

Health check:

```text
GET /api/health
```

## Docker

Build:

```bash
docker build -t docconvert-backend .
```

Run:

```bash
docker run --rm -p 8080:8080 docconvert-backend
```

Health check:

```text
http://localhost:8080/api/health
```

## API

### Convert to PDF

`POST /api/convert/to-pdf`

Form field:

```text
file
```

### Merge PDF

`POST /api/convert/merge`

Multiple form fields:

```text
files
```

### Split PDF

`POST /api/convert/split`

Form fields:

```text
file
page
```

### Compress PDF

`POST /api/convert/compress`

Form field:

```text
file
```

## Production notes

Before public Play Store launch, add:

- object storage for large files
- authentication
- per-user quotas
- payment/subscription system
- background job queue
- virus/malware scanning
- automatic cleanup
- stronger file validation
- logging/monitoring
- HTTPS
- privacy policy and terms
- production database

Never store uploaded documents permanently unless the product explicitly needs it and the privacy policy explains it.
