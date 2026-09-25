import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PDFDocument } from 'pdf-lib';
import { PdfExportService } from './pdf-export.service';
import { CoordinateService } from './coordinate.service';
import { PageMeta, TextAnnotation, ImageAnnotation, CoverAnnotation } from '../models/pdf-editor.models';

describe('PdfExportService', () => {
  let exportService: PdfExportService;
  let samplePdfBytes: Uint8Array;

  // 1x1 transparent PNG
  const samplePngDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [PdfExportService, CoordinateService]
    });
    exportService = TestBed.inject(PdfExportService);

    // Create a 2-page sample PDF
    const doc = await PDFDocument.create();
    const p1 = doc.addPage([612, 792]);
    p1.drawText('Original Page 1');
    const p2 = doc.addPage([612, 792]);
    p2.drawText('Original Page 2');
    samplePdfBytes = await doc.save();
  });

  it('should export all pages preserving original file structure', async () => {
    const pages: PageMeta[] = [
      {
        pageIndex: 0,
        originalPageIndex: 0,
        pageNumber: 1,
        width: 612,
        height: 792,
        rotation: 0
      },
      {
        pageIndex: 1,
        originalPageIndex: 1,
        pageNumber: 2,
        width: 612,
        height: 792,
        rotation: 0
      }
    ];

    const result = await exportService.exportPdf(samplePdfBytes, pages, [], {
      scope: 'all'
    });

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);

    const loaded = await PDFDocument.load(result);
    expect(loaded.getPageCount()).toBe(2);
  });

  it('should bake in text, image/signature, and cover-up annotations onto the exported PDF', async () => {
    const pages: PageMeta[] = [
      {
        pageIndex: 0,
        originalPageIndex: 0,
        pageNumber: 1,
        width: 612,
        height: 792,
        rotation: 0
      }
    ];

    const textAnn: TextAnnotation = {
      id: 'text-1',
      type: 'text',
      pageIndex: 0,
      x: 100,
      y: 100,
      width: 200,
      height: 40,
      rotation: 0,
      opacity: 1,
      zIndex: 1,
      text: 'Approved by Reviewer',
      fontSize: 16,
      fontFamily: 'Helvetica',
      color: '#059669',
      isBold: true,
      isItalic: false,
      align: 'left'
    };

    const sigAnn: ImageAnnotation = {
      id: 'sig-1',
      type: 'image',
      pageIndex: 0,
      x: 100,
      y: 200,
      width: 150,
      height: 50,
      rotation: 0,
      opacity: 0.9,
      zIndex: 2,
      dataUrl: samplePngDataUrl,
      mimeType: 'image/png',
      isSignature: true,
      aspectRatio: 3
    };

    const coverAnn: CoverAnnotation = {
      id: 'cover-1',
      type: 'cover',
      pageIndex: 0,
      x: 50,
      y: 300,
      width: 300,
      height: 60,
      rotation: 0,
      opacity: 1,
      zIndex: 3,
      fillColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderWidth: 1
    };

    const result = await exportService.exportPdf(
      samplePdfBytes,
      pages,
      [textAnn, sigAnn, coverAnn],
      { scope: 'all' }
    );

    expect(result.length).toBeGreaterThan(0);
    const loaded = await PDFDocument.load(result);
    expect(loaded.getPageCount()).toBe(1);
  });

  it('should apply page rotation and page omissions on export', async () => {
    const pages: PageMeta[] = [
      {
        pageIndex: 0,
        originalPageIndex: 0,
        pageNumber: 1,
        width: 612,
        height: 792,
        rotation: 90 // Rotated 90 deg clockwise
      },
      {
        pageIndex: 1,
        originalPageIndex: 1,
        pageNumber: 2,
        width: 612,
        height: 792,
        rotation: 0,
        isDeleted: true // Omitted
      }
    ];

    const result = await exportService.exportPdf(samplePdfBytes, pages, [], {
      scope: 'all'
    });

    const loaded = await PDFDocument.load(result);
    expect(loaded.getPageCount()).toBe(1);
    const page0 = loaded.getPage(0);
    expect(page0.getRotation().angle).toBe(90);
  });

  it('should export selected single page when scope is current', async () => {
    const pages: PageMeta[] = [
      {
        pageIndex: 0,
        originalPageIndex: 1, // Second page reordered to first
        pageNumber: 1,
        width: 612,
        height: 792,
        rotation: 0
      },
      {
        pageIndex: 1,
        originalPageIndex: 0,
        pageNumber: 2,
        width: 612,
        height: 792,
        rotation: 0
      }
    ];

    const result = await exportService.exportPdf(samplePdfBytes, pages, [], {
      scope: 'current'
    });

    const loaded = await PDFDocument.load(result);
    expect(loaded.getPageCount()).toBe(1);
  });
});
