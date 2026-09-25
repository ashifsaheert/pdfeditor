import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PDFDocument, rgb } from 'pdf-lib';
import { PdfExportService } from './pdf-export.service';
import { CoordinateService } from './coordinate.service';
import { EditorStateService } from './editor-state.service';
import {
  CoverAnnotation,
  ImageAnnotation,
  PageMeta,
  TextAnnotation
} from '../models/pdf-editor.models';

describe('Multi-Page Document Editing and Export Flow', () => {
  let exportService: PdfExportService;
  let stateService: EditorStateService;
  let coordinateService: CoordinateService;
  let originalPdfBytes: Uint8Array;

  // 1x1 transparent PNG data URL for signature test
  const sampleSignaturePng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [PdfExportService, CoordinateService, EditorStateService]
    });

    exportService = TestBed.inject(PdfExportService);
    stateService = TestBed.inject(EditorStateService);
    coordinateService = TestBed.inject(CoordinateService);

    // Create a 3-page source PDF document with distinct content
    const src = await PDFDocument.create();
    for (let i = 1; i <= 3; i++) {
      const page = src.addPage([612, 792]);
      page.drawText(`Original Source Document - Page ${i}`, {
        x: 50,
        y: 700,
        size: 18,
        color: rgb(0, 0, 0)
      });
    }
    originalPdfBytes = await src.save();

    // Initialize document state in EditorStateService
    const pages: PageMeta[] = [
      { pageIndex: 0, originalPageIndex: 0, pageNumber: 1, width: 612, height: 792, rotation: 0 },
      { pageIndex: 1, originalPageIndex: 1, pageNumber: 2, width: 612, height: 792, rotation: 0 },
      { pageIndex: 2, originalPageIndex: 2, pageNumber: 3, width: 612, height: 792, rotation: 0 }
    ];

    stateService.setDocument(
      {
        name: 'contract.pdf',
        sizeBytes: originalPdfBytes.byteLength,
        pageCount: 3,
        rawBytes: originalPdfBytes
      },
      pages
    );
  });

  it('should preserve original source bytes immutably throughout operations', async () => {
    const originalLength = originalPdfBytes.byteLength;
    const originalFirstByte = originalPdfBytes[0];

    // Add annotations and reorder pages
    stateService.reorderPages(0, 2);
    stateService.rotatePage(1, 90);

    expect(originalPdfBytes.byteLength).toBe(originalLength);
    expect(originalPdfBytes[0]).toBe(originalFirstByte);
  });

  it('should support full multi-page lifecycle: adding annotations, signatures, cover-ups, rotating, and exporting', async () => {
    // 1. Add text annotation to Page 1
    const textAnnotation: TextAnnotation = {
      id: 'text-reviewer',
      type: 'text',
      pageIndex: 0,
      x: 72,
      y: 100,
      width: 250,
      height: 40,
      rotation: 0,
      opacity: 1,
      zIndex: 10,
      text: 'Reviewed and Approved',
      fontSize: 16,
      fontFamily: 'Helvetica',
      color: '#059669',
      isBold: true,
      isItalic: false,
      align: 'left'
    };
    stateService.addAnnotation(textAnnotation);

    // 2. Add signature image to Page 2
    const signatureAnnotation: ImageAnnotation = {
      id: 'sig-officer',
      type: 'image',
      pageIndex: 1,
      x: 150,
      y: 350,
      width: 140,
      height: 50,
      rotation: 0,
      opacity: 0.95,
      zIndex: 20,
      dataUrl: sampleSignaturePng,
      mimeType: 'image/png',
      isSignature: true,
      aspectRatio: 2.8
    };
    stateService.addAnnotation(signatureAnnotation);

    // 3. Add white cover-up rectangle on Page 1 (visual redaction)
    const coverAnnotation: CoverAnnotation = {
      id: 'cover-confidential',
      type: 'cover',
      pageIndex: 0,
      x: 72,
      y: 500,
      width: 300,
      height: 35,
      rotation: 0,
      opacity: 1,
      zIndex: 15,
      fillColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderWidth: 1
    };
    stateService.addAnnotation(coverAnnotation);

    // 4. Rotate Page 2 by 90 degrees
    stateService.rotatePage(1, 90);

    // 5. Delete Page 3 (omit from final export)
    stateService.deletePage(2);
    expect(stateService.activePages().length).toBe(2);

    // 6. Perform PDF Export
    const exportedBytes = await exportService.exportPdf(
      originalPdfBytes,
      stateService.pages(),
      stateService.annotations(),
      { scope: 'all' }
    );

    expect(exportedBytes).toBeInstanceOf(Uint8Array);
    expect(exportedBytes.length).toBeGreaterThan(0);

    // 7. Inspect and verify the exported document structure
    const exportedDoc = await PDFDocument.load(exportedBytes);
    // Page 3 was deleted, so only 2 pages should remain
    expect(exportedDoc.getPageCount()).toBe(2);

    // Verify Page 1
    const p1 = exportedDoc.getPage(0);
    expect(p1.getWidth()).toBe(612);
    expect(p1.getHeight()).toBe(792);
    expect(p1.getRotation().angle).toBe(0);

    // Verify Page 2 has the 90 deg rotation
    const p2 = exportedDoc.getPage(1);
    expect(p2.getRotation().angle).toBe(90);
  });

  it('should respect zoom scaling invariance in coordinate mappings', () => {
    // Coordinate mapping should remain consistent whether zoomed in at 2.5x or zoomed out at 0.5x
    const screenCoordAt1x = 144; // 2 inches
    const pt1 = coordinateService.screenToPdfPoints(screenCoordAt1x, 1.0);
    expect(pt1).toBe(144);

    const screenCoordAt2x = 288;
    const pt2 = coordinateService.screenToPdfPoints(screenCoordAt2x, 2.0);
    expect(pt2).toBe(144);

    const screenCoordAtHalf = 72;
    const pt3 = coordinateService.screenToPdfPoints(screenCoordAtHalf, 0.5);
    expect(pt3).toBe(144);
  });
});
