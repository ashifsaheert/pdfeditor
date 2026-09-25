# PDF Studio - Production-Ready Client-Side PDF Editor

PDF Studio is a high-precision, production-grade PDF editor built with **Angular 22**, **TypeScript**, **PDF.js**, and **pdf-lib**. 

It runs **100% locally in the browser**. No backend, API server, database, authentication service, cloud file upload, or external analytics are used. Documents never leave the user's machine.

---

## Key Features

1. **100% Client-Side Privacy**:
   - Zero network transmission of document bytes, extracted text, or annotations.
   - All PDF parsing, canvas rendering, and binary PDF exports are processed inside the browser sandbox.
2. **Multi-Page Rendering & Navigation**:
   - Powered by PDF.js with local Web Worker bundling.
   - High-DPI canvas rendering scaled to `window.devicePixelRatio` for retina clarity.
   - Thumbnail sidebar, page jumping, previous/next controls, and in-document text search.
3. **Typographic Text Annotations**:
   - Standard PDF fonts (**Helvetica**, **Times Roman**, **Courier**) with bold/italic variants.
   - Customizable font size (8pt to 72pt), color picker, alignments (left, center, right), and opacity.
   - Double-click to edit inline, drag to reposition, resize handles, and delete.
4. **Signatures & Transparent Images**:
   - Interactive canvas signature pad with smooth pen strokes, ink colors, and stroke thickness.
   - Automatic trimming of transparent bounding margins.
   - Image upload supporting PNG, JPEG, and transparent PNGs.
   - 8-point resize handles and 360° rotation handle.
5. **Visual Cover-up / Redaction**:
   - White (or custom color) rectangles to visually cover existing content.
   - Prominent UI disclaimer: *Visual cover-up only: does not sanitize underlying text or vector streams*.
6. **Page Operations**:
   - Rotate individual pages 90° clockwise or 180°.
   - Delete pages with confirmation dialog.
   - Reorder pages via move up/down controls.
   - Export all pages or only current page.
7. **Undo / Redo & Shortcuts**:
   - Command pattern history stack tracking all annotation changes and page operations.
   - Keyboard shortcuts: `Ctrl+Z` (Undo), `Ctrl+Y` / `Ctrl+Shift+Z` (Redo), `Ctrl+S` (Export), `Delete` / `Backspace` (Delete element), `+` / `-` / `0` (Zoom).
8. **Mathematical Coordinate Mapping**:
   - Dedicated `CoordinateService` accurately transforms between Screen DOM coordinates (origin top-left, scaled by zoom) and PDF point coordinates (origin bottom-left, 72 DPI PostScript points, rotated pages).
9. **PWA Installable**:
   - Includes `manifest.webmanifest`, vector app icons, and offline standalone display.

---

## Coordinate Transformation Architecture

PDF coordinates and DOM/screen coordinates use fundamentally different conventions:

| Coordinate System | Origin | X Axis | Y Axis | Units |
| :--- | :--- | :--- | :--- | :--- |
| **Browser DOM** | Top-Left | Increases Right | Increases Down | CSS Pixels (scaled by Zoom) |
| **PDF Page Space** | Bottom-Left | Increases Right | Increases Up | Points ($1/72$ inch) |

To guarantee resolution independence, annotations are stored in unscaled PDF points $(x, y, w, h)$ relative to the visual top-left of the page.

On export to `pdf-lib`, coordinates are converted based on the page's intrinsic rotation:
- **$0^\circ$ (unrotated)**: $x_{\text{pdf}} = x, \quad y_{\text{pdf}} = H - y - h$
- **$90^\circ$ CW**: $x_{\text{pdf}} = y, \quad y_{\text{pdf}} = x + w, \quad \theta_{\text{pdf}} = -90^\circ - \theta$
- **$180^\circ$ CW**: $x_{\text{pdf}} = W - x, \quad y_{\text{pdf}} = y + h, \quad \theta_{\text{pdf}} = -180^\circ - \theta$
- **$270^\circ$ CW**: $x_{\text{pdf}} = y + h, \quad y_{\text{pdf}} = H - x - w, \quad \theta_{\text{pdf}} = 90^\circ - \theta$

---

## Local Development

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended, tested on Node v24.17.0)
- **npm**: v9.0.0 or higher

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd pdfeditor

# Install dependencies
npm install
```

### Running the Development Server
```bash
npm start
# or
npx ng serve
```
Navigate to `http://localhost:4200/` in your browser.

### Running Unit Tests
```bash
npm test -- --watch=false
```
All 34 automated unit tests covering coordinate transformations, annotation management, undo/redo, and multi-page PDF export will execute with Vitest.

### Building for Production
```bash
npm run build
```
The optimized production bundle is generated in `dist/pdfeditor/browser`.

---

## Vercel Deployment Instructions

### 1. Deploy via Vercel Web Dashboard (Recommended)

1. Push your repository to **GitHub**, **GitLab**, or **Bitbucket**.
2. Log in to [Vercel](https://vercel.com/) and click **"Add New..." > "Project"**.
3. Import your `pdfeditor` repository.
4. Configure the project settings:
   - **Framework Preset**: `Angular`
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist/pdfeditor/browser`
5. Click **Deploy**. Vercel will build and serve your static Angular application globally.

### 2. Deploy via Vercel CLI

```bash
# Install Vercel CLI globally (if not installed)
npm install -g vercel

# Log in to your Vercel account
vercel login

# Deploy preview build
vercel

# Deploy to production
vercel --prod
```

### Configuration Details (`vercel.json`)
The application includes a root `vercel.json` configured for SPA routing and asset caching:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "cleanUrls": true,
  "trailingSlash": false,
  "outputDirectory": "dist/pdfeditor/browser",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    },
    {
      "source": "/(pdfjs|assets)/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

---

## PDF.js Worker Configuration in Production

The PDF.js worker script (`pdf.worker.min.mjs`) is copied during the build from `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` directly into the `pdfjs/` asset directory in `dist/pdfeditor/browser/pdfjs/`.

In `src/app/core/services/pdf-loader.service.ts`:
```ts
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdfjs/pdf.worker.min.mjs';
```
This guarantees the worker is loaded locally from the same origin on any static hosting provider without CORS issues or CDN dependencies.

---

## License
MIT
