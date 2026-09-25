import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { CoordinateService } from './coordinate.service';
import { EditorStateService } from './editor-state.service';
import { PdfExportService } from './pdf-export.service';
import { PdfLoaderService } from './pdf-loader.service';
import {
  CoverAnnotation,
  ExtractedTextItem,
  ImageAnnotation,
  PageMeta,
  StandardFontFamily,
  TextAnnotation,
  TextReplacementAnnotation
} from '../models/pdf-editor.models';

describe('Edit Existing Text - Comprehensive Feature Test Suite', () => {
  let coordinateService: CoordinateService;
  let stateService: EditorStateService;
  let exportService: PdfExportService;
  let loaderService: PdfLoaderService;
  let realPdfBytes: Uint8Array;

  // 1x1 transparent PNG for signature test
  const sampleSignaturePng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [CoordinateService, EditorStateService, PdfExportService, PdfLoaderService]
    });

    coordinateService = TestBed.inject(CoordinateService);
    stateService = TestBed.inject(EditorStateService);
    exportService = TestBed.inject(PdfExportService);
    loaderService = TestBed.inject(PdfLoaderService);

    // Create a real multi-page PDF with diverse content:
    // Page 1: Individual words, complete lines, multiline text, different fonts (Helvetica, TimesRoman, Courier)
    // Page 2: Non-white background banner (tinted colored section)
    // Page 3: Rotated content and data table
    const doc = await PDFDocument.create();
    const helv = await doc.embedFont(StandardFonts.Helvetica);
    const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const times = await doc.embedFont(StandardFonts.TimesRoman);
    const courier = await doc.embedFont(StandardFonts.Courier);

    // Page 1
    const p1 = doc.addPage([612, 792]);
    p1.drawText('Invoice', { x: 50, y: 720, size: 24, font: helvBold });
    p1.drawText('Customer Name: John Doe', { x: 50, y: 680, size: 14, font: helv });
    p1.drawText('Agreement terms and conditions apply to this invoice.', {
      x: 50,
      y: 640,
      size: 12,
      font: times
    });
    p1.drawText('ACCOUNT_REF: 9948271A', { x: 50, y: 600, size: 12, font: courier });

    // Page 2: Non-white background
    const p2 = doc.addPage([612, 792]);
    // Draw non-white background box (cream/beige #fef3c7)
    p2.drawRectangle({
      x: 40,
      y: 500,
      width: 532,
      height: 200,
      color: rgb(0.99, 0.95, 0.78)
    });
    p2.drawText('Confidential Internal Report', {
      x: 60,
      y: 650,
      size: 18,
      font: helvBold,
      color: rgb(0.1, 0.1, 0.1)
    });
    p2.drawText('Quarterly financial analysis on beige section.', {
      x: 60,
      y: 610,
      size: 12,
      font: times
    });

    // Page 3
    const p3 = doc.addPage([792, 612]); // Landscape page
    p3.drawText('Landscape Data Table', { x: 50, y: 540, size: 20, font: helvBold });

    realPdfBytes = await doc.save();

    const pages: PageMeta[] = [
      { pageIndex: 0, originalPageIndex: 0, pageNumber: 1, width: 612, height: 792, rotation: 0 },
      { pageIndex: 1, originalPageIndex: 1, pageNumber: 2, width: 612, height: 792, rotation: 0 },
      { pageIndex: 2, originalPageIndex: 2, pageNumber: 3, width: 792, height: 612, rotation: 0 }
    ];

    stateService.setDocument(
      {
        name: 'test-invoice.pdf',
        sizeBytes: realPdfBytes.byteLength,
        pageCount: 3,
        rawBytes: realPdfBytes
      },
      pages
    );
  });

  describe('1. Text Extraction & Font Detection', () => {
    it('should detect standard font families from PDF font names', () => {
      expect(loaderService.detectStandardFontFamily('Helvetica-Bold')).toBe('Helvetica');
      expect(loaderService.detectStandardFontFamily('ArialMT')).toBe('Helvetica');
      expect(loaderService.detectStandardFontFamily('TimesNewRomanPSMT')).toBe('TimesRoman');
      expect(loaderService.detectStandardFontFamily('Times-Roman')).toBe('TimesRoman');
      expect(loaderService.detectStandardFontFamily('CourierNewPS-BoldMT')).toBe('Courier');
      expect(loaderService.detectStandardFontFamily('Courier')).toBe('Courier');
      expect(loaderService.detectStandardFontFamily('UnknownFontName')).toBe('Helvetica');
    });

    it('should accurately calculate visual text bounds for PDF items', () => {
      // Unrotated US letter page: 612 x 792
      // Text baseline at PDF x=50, y=680, fontSize=14, width=160
      const transform = [14, 0, 0, 14, 50, 680];
      const bounds = coordinateService.calculateVisualTextBounds(transform, 160, 14, 612, 792, 0);

      expect(bounds.x).toBe(50);
      expect(bounds.width).toBeGreaterThanOrEqual(160);
      expect(bounds.fontSize).toBe(14);
      // In 0 deg, visual top is H - 680 - ascent = 792 - 680 - 14 * 0.78 ≈ 101.08
      expect(bounds.y).toBeCloseTo(792 - 680 - 14 * 0.78, 1);
    });

    it('should calculate text bounds correctly for complete lines and individual words', () => {
      // Short word
      const wordTransform = [12, 0, 0, 12, 100, 500];
      const wordBounds = coordinateService.calculateVisualTextBounds(wordTransform, 35, 12, 612, 792, 0);
      expect(wordBounds.width).toBeGreaterThanOrEqual(35);
      expect(wordBounds.height).toBeGreaterThanOrEqual(12);

      // Long line
      const lineTransform = [12, 0, 0, 12, 50, 400];
      const lineBounds = coordinateService.calculateVisualTextBounds(lineTransform, 480, 12, 612, 792, 0);
      expect(lineBounds.width).toBeGreaterThanOrEqual(480);
      expect(lineBounds.x).toBe(50);
    });
  });

  describe('2. Coordinate Transformations across Rotations and Zoom Levels', () => {
    const W = 612;
    const H = 792;
    const sampleBounds = { x: 50, y: 100, width: 220, height: 25, rotation: 0 };

    it('should maintain exact symmetry between visual coordinates and PDF coordinates across 0, 90, 180, 270 rotations', () => {
      const rotations = [0, 90, 180, 270];

      rotations.forEach((rot) => {
        // Map visual annotation to pdf-lib space
        const pdfCoords = coordinateService.mapAnnotationToPdfCoordinates(
          sampleBounds,
          W,
          H,
          rot
        );

        // Map pdf-lib space back to visual annotation
        const recovered = coordinateService.mapPdfToVisualCoordinates(
          pdfCoords.x,
          pdfCoords.y,
          pdfCoords.width,
          pdfCoords.height,
          W,
          H,
          rot
        );

        expect(recovered.x).toBeCloseTo(sampleBounds.x, 1);
        expect(recovered.y).toBeCloseTo(sampleBounds.y, 1);
        expect(recovered.width).toBeCloseTo(sampleBounds.width, 1);
        expect(recovered.height).toBeCloseTo(sampleBounds.height, 1);
      });
    });

    it('should be invariant to screen zoom levels (0.5x, 1.0x, 2.0x, 3.0x)', () => {
      const zoomLevels = [0.25, 0.5, 1.0, 1.5, 2.0, 3.0];
      const basePointX = 144.5;
      const basePointY = 288.75;

      zoomLevels.forEach((zoom) => {
        const screenX = coordinateService.pdfPointsToScreen(basePointX, zoom);
        const screenY = coordinateService.pdfPointsToScreen(basePointY, zoom);

        const restoredX = coordinateService.screenToPdfPoints(screenX, zoom);
        const restoredY = coordinateService.screenToPdfPoints(screenY, zoom);

        expect(restoredX).toBeCloseTo(basePointX, 4);
        expect(restoredY).toBeCloseTo(basePointY, 4);
      });
    });

    it('should handle landscape page dimensions properly', () => {
      const landscapeW = 792;
      const landscapeH = 612;
      const landscapeBounds = { x: 80, y: 120, width: 300, height: 40, rotation: 0 };

      const pdfCoords = coordinateService.mapAnnotationToPdfCoordinates(
        landscapeBounds,
        landscapeW,
        landscapeH,
        0
      );
      expect(pdfCoords.x).toBe(80);
      expect(pdfCoords.y).toBe(landscapeH - 120 - 40);

      const recovered = coordinateService.mapPdfToVisualCoordinates(
        pdfCoords.x,
        pdfCoords.y,
        pdfCoords.width,
        pdfCoords.height,
        landscapeW,
        landscapeH,
        0
      );
      expect(recovered.x).toBe(80);
      expect(recovered.y).toBe(120);
    });
  });

  describe('3. Adjustable Background Cover & Color Sampling', () => {
    it('should gracefully sample fallback color when canvas is not available', () => {
      const color = loaderService.sampleCanvasColorAt(null, 100, 100, 1.0);
      expect(color).toBe('#ffffff');
    });

    it('should allow text replacement annotation to specify any custom background color', () => {
      const replacement: TextReplacementAnnotation = {
        id: 'replace-beige',
        type: 'text-replace',
        pageIndex: 1,
        x: 60,
        y: 650,
        width: 250,
        height: 30,
        rotation: 0,
        opacity: 1,
        zIndex: 1,
        originalText: 'Confidential Internal Report',
        text: 'Public Annual Summary',
        fontSize: 18,
        fontFamily: 'Helvetica',
        color: '#1e293b',
        backgroundColor: '#fef3c7', // Custom beige background matching non-white page surface
        isBold: true,
        isItalic: false,
        align: 'left'
      };

      stateService.addAnnotation(replacement);
      const added = stateService.annotations()[0] as TextReplacementAnnotation;
      expect(added.backgroundColor).toBe('#fef3c7');

      // Update background color to a different tone
      stateService.updateAnnotation(replacement.id, { backgroundColor: '#e0f2fe' });
      const updated = stateService.annotations()[0] as TextReplacementAnnotation;
      expect(updated.backgroundColor).toBe('#e0f2fe');
    });
  });

  describe('4. Undo / Redo for Text Replacements', () => {
    it('should support full undo and redo lifecycle for adding text replacements', () => {
      const replacement: TextReplacementAnnotation = {
        id: 'replace-1',
        type: 'text-replace',
        pageIndex: 0,
        x: 50,
        y: 680,
        width: 200,
        height: 25,
        rotation: 0,
        opacity: 1,
        zIndex: 10,
        originalText: 'Customer Name: John Doe',
        text: 'Customer Name: Jane Smith',
        fontSize: 14,
        fontFamily: 'Helvetica',
        color: '#000000',
        backgroundColor: '#ffffff',
        isBold: false,
        isItalic: false,
        align: 'left'
      };

      stateService.addAnnotation(replacement);
      expect(stateService.annotations().length).toBe(1);
      expect(stateService.canUndo()).toBe(true);

      // Undo addition
      stateService.undo();
      expect(stateService.annotations().length).toBe(0);
      expect(stateService.canRedo()).toBe(true);

      // Redo addition
      stateService.redo();
      expect(stateService.annotations().length).toBe(1);
      expect((stateService.annotations()[0] as TextReplacementAnnotation).text).toBe(
        'Customer Name: Jane Smith'
      );
    });

    it('should support undo and redo for modifying replacement text properties', () => {
      const replacement: TextReplacementAnnotation = {
        id: 'replace-2',
        type: 'text-replace',
        pageIndex: 0,
        x: 50,
        y: 640,
        width: 300,
        height: 25,
        rotation: 0,
        opacity: 1,
        zIndex: 10,
        originalText: 'Old text',
        text: 'First Edit',
        fontSize: 12,
        fontFamily: 'TimesRoman',
        color: '#111827',
        backgroundColor: '#ffffff',
        isBold: false,
        isItalic: false,
        align: 'left'
      };

      stateService.addAnnotation(replacement);
      stateService.updateAnnotation('replace-2', {
        text: 'Second Edit with Larger Font',
        fontSize: 18,
        color: '#dc2626'
      });

      const modified = stateService.annotations()[0] as TextReplacementAnnotation;
      expect(modified.text).toBe('Second Edit with Larger Font');
      expect(modified.fontSize).toBe(18);

      // Undo modification
      stateService.undo();
      const reverted = stateService.annotations()[0] as TextReplacementAnnotation;
      expect(reverted.text).toBe('First Edit');
      expect(reverted.fontSize).toBe(12);

      // Redo modification
      stateService.redo();
      const restored = stateService.annotations()[0] as TextReplacementAnnotation;
      expect(restored.text).toBe('Second Edit with Larger Font');
    });

    it('should support editing multiple items across multiple pages with atomic history', () => {
      const repPage1: TextReplacementAnnotation = {
        id: 'rep-p1',
        type: 'text-replace',
        pageIndex: 0,
        x: 50,
        y: 720,
        width: 150,
        height: 35,
        rotation: 0,
        opacity: 1,
        zIndex: 1,
        originalText: 'Invoice',
        text: 'Receipt',
        fontSize: 24,
        fontFamily: 'Helvetica',
        color: '#059669',
        backgroundColor: '#ffffff',
        isBold: true,
        isItalic: false,
        align: 'left'
      };

      const repPage2: TextReplacementAnnotation = {
        id: 'rep-p2',
        type: 'text-replace',
        pageIndex: 1,
        x: 60,
        y: 610,
        width: 320,
        height: 25,
        rotation: 0,
        opacity: 1,
        zIndex: 2,
        originalText: 'Quarterly financial analysis',
        text: 'Audited Annual Statement',
        fontSize: 12,
        fontFamily: 'TimesRoman',
        color: '#1e3a8a',
        backgroundColor: '#fef3c7',
        isBold: false,
        isItalic: true,
        align: 'left'
      };

      stateService.addAnnotation(repPage1);
      stateService.addAnnotation(repPage2);
      expect(stateService.annotations().length).toBe(2);

      // Undo Page 2 edit
      stateService.undo();
      expect(stateService.annotations().length).toBe(1);
      expect(stateService.annotations()[0].id).toBe('rep-p1');

      // Undo Page 1 edit
      stateService.undo();
      expect(stateService.annotations().length).toBe(0);

      // Redo Page 1
      stateService.redo();
      expect(stateService.annotations().length).toBe(1);
      expect(stateService.annotations()[0].id).toBe('rep-p1');

      // Redo Page 2
      stateService.redo();
      expect(stateService.annotations().length).toBe(2);
    });
  });

  describe('5. PDF Export with Text Replacements & Multi-Feature Preservation', () => {
    it('should export a valid PDF with visual text replacements', async () => {
      const replacement: TextReplacementAnnotation = {
        id: 'rep-inv',
        type: 'text-replace',
        pageIndex: 0,
        x: 50,
        y: 80,
        width: 180,
        height: 35,
        rotation: 0,
        opacity: 1,
        zIndex: 1,
        originalText: 'Invoice',
        text: 'PROFORMA INVOICE',
        fontSize: 20,
        fontFamily: 'Helvetica',
        color: '#4338ca',
        backgroundColor: '#ffffff',
        isBold: true,
        isItalic: false,
        align: 'left'
      };

      const exportedBytes = await exportService.exportPdf(
        realPdfBytes,
        stateService.pages(),
        [replacement],
        { scope: 'all' }
      );

      expect(exportedBytes).toBeInstanceOf(Uint8Array);
      expect(exportedBytes.byteLength).toBeGreaterThan(0);

      // Verify the exported PDF is valid and readable by pdf-lib
      const verifiedDoc = await PDFDocument.load(exportedBytes);
      expect(verifiedDoc.getPageCount()).toBe(3);
    });

    it('should support multi-line text replacements in exported PDF', async () => {
      const multilineReplacement: TextReplacementAnnotation = {
        id: 'rep-multiline',
        type: 'text-replace',
        pageIndex: 0,
        x: 50,
        y: 150,
        width: 350,
        height: 80,
        rotation: 0,
        opacity: 1,
        zIndex: 2,
        originalText: 'Single line text',
        text: 'Line 1: Special terms\nLine 2: Net 30 payment policy\nLine 3: Thank you for your business!',
        fontSize: 12,
        fontFamily: 'Helvetica',
        color: '#111827',
        backgroundColor: '#ffffff',
        isBold: false,
        isItalic: false,
        align: 'left'
      };

      const exportedBytes = await exportService.exportPdf(
        realPdfBytes,
        stateService.pages(),
        [multilineReplacement],
        { scope: 'all' }
      );

      const verifiedDoc = await PDFDocument.load(exportedBytes);
      expect(verifiedDoc.getPageCount()).toBe(3);
    });

    it('should export correctly with different font families (Helvetica, TimesRoman, Courier)', async () => {
      const repHelv: TextReplacementAnnotation = {
        id: 'f-helv',
        type: 'text-replace',
        pageIndex: 0,
        x: 50,
        y: 50,
        width: 150,
        height: 25,
        rotation: 0,
        opacity: 1,
        zIndex: 1,
        originalText: 'Orig Helv',
        text: 'Replacement Helvetica',
        fontSize: 12,
        fontFamily: 'Helvetica',
        color: '#000000',
        backgroundColor: '#ffffff',
        isBold: false,
        isItalic: false,
        align: 'left'
      };

      const repTimes: TextReplacementAnnotation = {
        id: 'f-times',
        type: 'text-replace',
        pageIndex: 0,
        x: 50,
        y: 90,
        width: 150,
        height: 25,
        rotation: 0,
        opacity: 1,
        zIndex: 2,
        originalText: 'Orig Times',
        text: 'Replacement Times Roman',
        fontSize: 12,
        fontFamily: 'TimesRoman',
        color: '#000000',
        backgroundColor: '#ffffff',
        isBold: true,
        isItalic: true,
        align: 'center'
      };

      const repCourier: TextReplacementAnnotation = {
        id: 'f-courier',
        type: 'text-replace',
        pageIndex: 0,
        x: 50,
        y: 130,
        width: 150,
        height: 25,
        rotation: 0,
        opacity: 1,
        zIndex: 3,
        originalText: 'Orig Courier',
        text: 'CODE-XYZ-1234',
        fontSize: 12,
        fontFamily: 'Courier',
        color: '#000000',
        backgroundColor: '#ffffff',
        isBold: true,
        isItalic: false,
        align: 'right'
      };

      const exportedBytes = await exportService.exportPdf(
        realPdfBytes,
        stateService.pages(),
        [repHelv, repTimes, repCourier],
        { scope: 'current' }
      );

      const verifiedDoc = await PDFDocument.load(exportedBytes);
      expect(verifiedDoc.getPageCount()).toBe(1);
    });

    it('should export correctly with non-white background cover replacement', async () => {
      const repBeige: TextReplacementAnnotation = {
        id: 'rep-beige-export',
        type: 'text-replace',
        pageIndex: 1,
        x: 60,
        y: 100,
        width: 300,
        height: 35,
        rotation: 0,
        opacity: 1,
        zIndex: 5,
        originalText: 'Confidential Internal Report',
        text: 'Public Executive Overview',
        fontSize: 18,
        fontFamily: 'Helvetica',
        color: '#0f172a',
        backgroundColor: '#fef3c7', // Matching beige section on page 2
        isBold: true,
        isItalic: false,
        align: 'left'
      };

      const exportedBytes = await exportService.exportPdf(
        realPdfBytes,
        stateService.pages(),
        [repBeige],
        { scope: 'all' }
      );

      const verifiedDoc = await PDFDocument.load(exportedBytes);
      expect(verifiedDoc.getPageCount()).toBe(3);
    });

    it('should preserve existing annotations and page operations alongside text replacements without regression', async () => {
      // 1. Text Replacement on Page 1
      const rep: TextReplacementAnnotation = {
        id: 'rep-combo',
        type: 'text-replace',
        pageIndex: 0,
        x: 50,
        y: 100,
        width: 200,
        height: 30,
        rotation: 0,
        opacity: 1,
        zIndex: 1,
        originalText: 'Original text',
        text: 'Combined Replacement',
        fontSize: 14,
        fontFamily: 'Helvetica',
        color: '#059669',
        backgroundColor: '#ffffff',
        isBold: true,
        isItalic: false,
        align: 'left'
      };

      // 2. Added Text Annotation on Page 1
      const addedText: TextAnnotation = {
        id: 'text-added',
        type: 'text',
        pageIndex: 0,
        x: 50,
        y: 200,
        width: 180,
        height: 30,
        rotation: 0,
        opacity: 1,
        zIndex: 2,
        text: 'New Annotation Note',
        fontSize: 12,
        fontFamily: 'Helvetica',
        color: '#2563eb',
        isBold: false,
        isItalic: false,
        align: 'left'
      };

      // 3. Signature Image on Page 2
      const sigImage: ImageAnnotation = {
        id: 'sig-image',
        type: 'image',
        pageIndex: 1,
        x: 100,
        y: 300,
        width: 120,
        height: 40,
        rotation: 0,
        opacity: 1,
        zIndex: 3,
        dataUrl: sampleSignaturePng,
        mimeType: 'image/png',
        isSignature: true,
        aspectRatio: 3
      };

      // 4. White Cover-up annotation on Page 2
      const cover: CoverAnnotation = {
        id: 'cover-box',
        type: 'cover',
        pageIndex: 1,
        x: 100,
        y: 400,
        width: 200,
        height: 50,
        rotation: 0,
        opacity: 1,
        zIndex: 4,
        fillColor: '#ffffff',
        borderColor: '#cbd5e1',
        borderWidth: 1
      };

      // 5. Rotate Page 2 by 90 degrees
      stateService.rotatePage(1, 90);

      // 6. Delete Page 3
      stateService.deletePage(2);
      expect(stateService.activePages().length).toBe(2);

      const exportedBytes = await exportService.exportPdf(
        realPdfBytes,
        stateService.pages(),
        [rep, addedText, sigImage, cover],
        { scope: 'all' }
      );

      const docLoaded = await PDFDocument.load(exportedBytes);
      // Page 3 deleted -> exactly 2 pages remaining
      expect(docLoaded.getPageCount()).toBe(2);

      // Page 2 rotation preserved as 90 degrees
      const page2 = docLoaded.getPage(1);
      expect(page2.getRotation().angle).toBe(90);
    });

    it('should export a modified PDF and verify document integrity and dimensions', async () => {
      const rep: TextReplacementAnnotation = {
        id: 'rep-reopen',
        type: 'text-replace',
        pageIndex: 0,
        x: 50,
        y: 80,
        width: 200,
        height: 30,
        rotation: 0,
        opacity: 1,
        zIndex: 1,
        originalText: 'Invoice',
        text: 'REVISED INVOICE 2026',
        fontSize: 18,
        fontFamily: 'Helvetica',
        color: '#1e40af',
        backgroundColor: '#ffffff',
        isBold: true,
        isItalic: false,
        align: 'left'
      };

      const exportedBytes = await exportService.exportPdf(
        realPdfBytes,
        stateService.pages(),
        [rep],
        { scope: 'all' }
      );

      // Verify with PDFDocument
      expect(exportedBytes).toBeInstanceOf(Uint8Array);
      expect(exportedBytes.byteLength).toBeGreaterThan(0);

      const docLoaded = await PDFDocument.load(exportedBytes);
      expect(docLoaded.getPageCount()).toBe(3);

      const p1 = docLoaded.getPage(0);
      expect(p1.getWidth()).toBe(612);
      expect(p1.getHeight()).toBe(792);

      // Page 2 & 3 dimensions preserved
      const p2 = docLoaded.getPage(1);
      expect(p2.getWidth()).toBe(612);
      expect(p2.getHeight()).toBe(792);

      const p3 = docLoaded.getPage(2);
      expect(p3.getWidth()).toBe(792);
      expect(p3.getHeight()).toBe(612);
    });
  });
});
