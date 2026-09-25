import { Injectable } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

@Injectable({
  providedIn: 'root'
})
export class PdfLoaderService {
  private workerInitialized = false;

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    if (this.workerInitialized) return;
    if (typeof window !== 'undefined') {
      try {
        // Use local copied worker asset from /pdfjs/pdf.worker.min.mjs
        pdfjsLib.GlobalWorkerOptions.workerSrc = './pdfjs/pdf.worker.min.mjs';
        this.workerInitialized = true;
      } catch (err) {
        console.warn('PDF.js worker initialization warning:', err);
      }
    }
  }

  /**
   * Load PDF document from a File or byte array.
   */
  async loadDocument(data: Uint8Array | ArrayBuffer): Promise<pdfjsLib.PDFDocumentProxy> {
    this.initWorker();
    const loadingTask = pdfjsLib.getDocument({
      data: data instanceof Uint8Array ? data : new Uint8Array(data),
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/standard_fonts/'
    });
    return loadingTask.promise;
  }

  /**
   * Render a PDF page onto an HTMLCanvasElement with device pixel ratio scaling for crisp display.
   */
  async renderPageToCanvas(
    page: pdfjsLib.PDFPageProxy,
    canvas: HTMLCanvasElement,
    zoom: number,
    rotation: number
  ): Promise<{ cssWidth: number; cssHeight: number }> {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    // Total rotation is the page's intrinsic rotation plus user applied rotation
    const totalRotation = ((page.rotate + rotation) % 360 + 360) % 360;

    // Viewport at CSS scale (zoom)
    const cssViewport = page.getViewport({ scale: zoom, rotation: totalRotation });
    const cssWidth = Math.floor(cssViewport.width);
    const cssHeight = Math.floor(cssViewport.height);

    // Viewport scaled by devicePixelRatio for crisp rendering on Retina / high-DPI displays
    const renderViewport = page.getViewport({ scale: zoom * dpr, rotation: totalRotation });

    canvas.width = Math.floor(renderViewport.width);
    canvas.height = Math.floor(renderViewport.height);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Unable to obtain 2D canvas rendering context');
    }

    const renderContext = {
      canvasContext: ctx,
      viewport: renderViewport
    };

    await page.render(renderContext as any).promise;
    return { cssWidth, cssHeight };
  }

  /**
   * Render a low-resolution thumbnail of a page for the thumbnail sidebar.
   */
  async renderThumbnail(
    page: pdfjsLib.PDFPageProxy,
    rotation: number,
    targetWidth: number = 180
  ): Promise<string> {
    const totalRotation = ((page.rotate + rotation) % 360 + 360) % 360;
    const baseViewport = page.getViewport({ scale: 1.0, rotation: totalRotation });
    const scale = targetWidth / baseViewport.width;
    const viewport = page.getViewport({ scale, rotation: totalRotation });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return '';

    await page.render({
      canvasContext: ctx,
      viewport: viewport
    } as any).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    // Cleanup canvas
    canvas.width = 0;
    canvas.height = 0;
    return dataUrl;
  }

  /**
   * Extract all plain text from a page for search functionality.
   */
  async extractPageText(page: pdfjsLib.PDFPageProxy): Promise<string> {
    const textContent = await page.getTextContent();
    return textContent.items
      .map((item: any) => item.str || '')
      .join(' ');
  }

  /**
   * Generates a 3-page sample PDF locally using pdf-lib for testing without needing an uploaded file.
   */
  async createSamplePdf(): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);

    // Page 1: Welcome & Overview
    const page1 = pdfDoc.addPage([612, 792]); // Standard US Letter
    const { width: p1W, height: p1H } = page1.getSize();

    // Header banner
    page1.drawRectangle({
      x: 0,
      y: p1H - 120,
      width: p1W,
      height: 120,
      color: rgb(0.12, 0.16, 0.28)
    });

    page1.drawText('PDF Studio - Browser Document Editor', {
      x: 48,
      y: p1H - 65,
      size: 22,
      font: helveticaBold,
      color: rgb(1, 1, 1)
    });

    page1.drawText('100% Client-Side - Zero Cloud Uploads - Complete Privacy', {
      x: 48,
      y: p1H - 95,
      size: 11,
      font: helvetica,
      color: rgb(0.55, 0.75, 1.0)
    });

    // Content body
    page1.drawText('Sample Document for Editing & Annotation', {
      x: 48,
      y: p1H - 160,
      size: 16,
      font: helveticaBold,
      color: rgb(0.1, 0.15, 0.3)
    });

    const bodyParagraph =
      'This multi-page document was generated entirely in your browser using pdf-lib. ' +
      'You can freely add custom text annotations, upload or draw signatures, insert images, ' +
      'apply visual cover-up redactions, and rotate or reorder pages.';

    page1.drawText(bodyParagraph, {
      x: 48,
      y: p1H - 195,
      size: 11,
      font: helvetica,
      color: rgb(0.2, 0.25, 0.35),
      maxWidth: 516,
      lineHeight: 16
    });

    // Feature cards
    const features = [
      { title: 'Interactive Annotations', desc: 'Add text anywhere with custom fonts, colors, and sizes.' },
      { title: 'Signatures & Images', desc: 'Draw a digital signature or place transparent PNG images.' },
      { title: 'Page Management', desc: 'Rotate individual pages, reorder pages, or delete pages safely.' },
      { title: 'High-Fidelity Export', desc: 'Download a clean, valid PDF with all edits baked in.' }
    ];

    let startY = p1H - 280;
    features.forEach((feat, idx) => {
      const y = startY - idx * 60;
      page1.drawRectangle({
        x: 48,
        y: y - 10,
        width: 516,
        height: 50,
        color: rgb(0.96, 0.97, 0.99),
        borderColor: rgb(0.85, 0.88, 0.94),
        borderWidth: 1
      });

      page1.drawText(`0${idx + 1}.  ${feat.title}`, {
        x: 64,
        y: y + 20,
        size: 12,
        font: helveticaBold,
        color: rgb(0.2, 0.25, 0.5)
      });

      page1.drawText(feat.desc, {
        x: 64,
        y: y + 4,
        size: 10,
        font: helvetica,
        color: rgb(0.4, 0.45, 0.55)
      });
    });

    // Page 1 footer
    page1.drawText('Page 1 of 3 - PDF Studio Test Suite', {
      x: 48,
      y: 36,
      size: 9,
      font: helvetica,
      color: rgb(0.6, 0.65, 0.7)
    });

    // Page 2: Agreement & Signature Section
    const page2 = pdfDoc.addPage([612, 792]);
    const { height: p2H } = page2.getSize();

    page2.drawText('Document Review & Signature', {
      x: 48,
      y: p2H - 72,
      size: 20,
      font: helveticaBold,
      color: rgb(0.12, 0.16, 0.28)
    });

    page2.drawText('Section 2: Verification of Client-Side Execution', {
      x: 48,
      y: p2H - 105,
      size: 12,
      font: helveticaBold,
      color: rgb(0.3, 0.35, 0.45)
    });

    const agreementText =
      'By signing below, the user confirms that this application runs entirely inside ' +
      'their local browser sandbox. No document payloads or extracted text strings are ever ' +
      'transmitted across the network. All PDF modifications are compiled into binary PDF streams ' +
      'using the pdf-lib WebAssembly / JavaScript engine.';

    page2.drawText(agreementText, {
      x: 48,
      y: p2H - 135,
      size: 11,
      font: timesRoman,
      color: rgb(0.2, 0.2, 0.2),
      maxWidth: 516,
      lineHeight: 18
    });

    // Signature Box Placeholder
    page2.drawRectangle({
      x: 48,
      y: p2H - 320,
      width: 260,
      height: 100,
      color: rgb(0.98, 0.99, 1.0),
      borderColor: rgb(0.7, 0.75, 0.85),
      borderWidth: 1.5
    });

    page2.drawText('SIGN HERE', {
      x: 140,
      y: p2H - 275,
      size: 12,
      font: helveticaBold,
      color: rgb(0.6, 0.65, 0.75)
    });

    page2.drawLine({
      start: { x: 68, y: p2H - 295 },
      end: { x: 288, y: p2H - 295 },
      thickness: 1,
      color: rgb(0.75, 0.8, 0.9)
    });

    page2.drawText('Authorized Signature', {
      x: 68,
      y: p2H - 310,
      size: 9,
      font: helvetica,
      color: rgb(0.4, 0.45, 0.55)
    });

    // Date box
    page2.drawRectangle({
      x: 340,
      y: p2H - 320,
      width: 224,
      height: 100,
      color: rgb(0.98, 0.99, 1.0),
      borderColor: rgb(0.7, 0.75, 0.85),
      borderWidth: 1.5
    });

    page2.drawLine({
      start: { x: 360, y: p2H - 295 },
      end: { x: 544, y: p2H - 295 },
      thickness: 1,
      color: rgb(0.75, 0.8, 0.9)
    });

    page2.drawText('Date Signed', {
      x: 360,
      y: p2H - 310,
      size: 9,
      font: helvetica,
      color: rgb(0.4, 0.45, 0.55)
    });

    page2.drawText('Page 2 of 3 - PDF Studio Test Suite', {
      x: 48,
      y: 36,
      size: 9,
      font: helvetica,
      color: rgb(0.6, 0.65, 0.7)
    });

    // Page 3: Technical Specifications & Data Sheet
    const page3 = pdfDoc.addPage([612, 792]);
    const { height: p3H } = page3.getSize();

    page3.drawText('Technical Specifications', {
      x: 48,
      y: p3H - 72,
      size: 20,
      font: helveticaBold,
      color: rgb(0.12, 0.16, 0.28)
    });

    const specs = [
      ['Core PDF Engine', 'pdfjs-dist v6 & pdf-lib v1.17'],
      ['Framework', 'Angular 22 (Standalone SPA)'],
      ['Coordinate Precision', '72 DPI PostScript Unscaled Points'],
      ['Storage', '100% In-Memory / Local Blob URLs'],
      ['Redaction Type', 'Visual Overlay (Shape & Path Covered)'],
      ['PWA Installable', 'Yes (Service Worker & Manifest enabled)']
    ];

    specs.forEach((row, i) => {
      const y = p3H - 120 - i * 36;
      page3.drawRectangle({
        x: 48,
        y: y - 8,
        width: 516,
        height: 30,
        color: i % 2 === 0 ? rgb(0.97, 0.98, 0.99) : rgb(1, 1, 1)
      });
      page3.drawText(row[0], {
        x: 60,
        y: y + 8,
        size: 11,
        font: helveticaBold,
        color: rgb(0.2, 0.25, 0.35)
      });
      page3.drawText(row[1], {
        x: 260,
        y: y + 8,
        size: 11,
        font: helvetica,
        color: rgb(0.3, 0.35, 0.45)
      });
    });

    page3.drawText('Page 3 of 3 - PDF Studio Test Suite', {
      x: 48,
      y: 36,
      size: 9,
      font: helvetica,
      color: rgb(0.6, 0.65, 0.7)
    });

    return pdfDoc.save();
  }
}
