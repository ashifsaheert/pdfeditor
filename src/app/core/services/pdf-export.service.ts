import { Injectable, inject } from '@angular/core';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
  PDFPage,
  PDFFont,
  RGB
} from 'pdf-lib';
import {
  Annotation,
  CoverAnnotation,
  ExportOptions,
  ImageAnnotation,
  PageMeta,
  StandardFontFamily,
  TextAnnotation
} from '../models/pdf-editor.models';
import { CoordinateService } from './coordinate.service';

@Injectable({
  providedIn: 'root'
})
export class PdfExportService {
  private coordinateService = inject(CoordinateService);

  /**
   * Export edited PDF document preserving the original and baking in all page reordering,
   * rotations, omissions, text annotations, images/signatures, and cover-up redactions.
   */
  async exportPdf(
    originalBytes: Uint8Array,
    pages: PageMeta[],
    annotations: Annotation[],
    options: ExportOptions
  ): Promise<Uint8Array> {
    const srcDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
    const exportDoc = await PDFDocument.create();

    // Font cache for standard PDF fonts
    const fontCache = new Map<string, PDFFont>();
    const getFont = async (
      family: StandardFontFamily,
      bold: boolean,
      italic: boolean
    ): Promise<PDFFont> => {
      let fontName: StandardFonts = StandardFonts.Helvetica;
      if (family === 'TimesRoman') {
        if (bold && italic) fontName = StandardFonts.TimesRomanBoldItalic;
        else if (bold) fontName = StandardFonts.TimesRomanBold;
        else if (italic) fontName = StandardFonts.TimesRomanItalic;
        else fontName = StandardFonts.TimesRoman;
      } else if (family === 'Courier') {
        if (bold && italic) fontName = StandardFonts.CourierBoldOblique;
        else if (bold) fontName = StandardFonts.CourierBold;
        else if (italic) fontName = StandardFonts.CourierOblique;
        else fontName = StandardFonts.Courier;
      } else {
        // Helvetica
        if (bold && italic) fontName = StandardFonts.HelveticaBoldOblique;
        else if (bold) fontName = StandardFonts.HelveticaBold;
        else if (italic) fontName = StandardFonts.HelveticaOblique;
        else fontName = StandardFonts.Helvetica;
      }

      if (!fontCache.has(fontName)) {
        const embedded = await exportDoc.embedFont(fontName);
        fontCache.set(fontName, embedded);
      }
      return fontCache.get(fontName)!;
    };

    // Determine target pages to export
    const activePages = pages.filter((p) => !p.isDeleted);
    let targetPages: PageMeta[] = [];

    if (options.scope === 'current') {
      const currentPage = activePages[0];
      if (currentPage) targetPages = [currentPage];
    } else if (options.scope === 'custom' && options.customPages?.length) {
      const pageSet = new Set(options.customPages);
      targetPages = activePages.filter((p) => pageSet.has(p.pageNumber));
    } else {
      // 'all'
      targetPages = activePages;
    }

    if (targetPages.length === 0) {
      throw new Error('No pages selected for export.');
    }

    // Process each page
    for (let i = 0; i < targetPages.length; i++) {
      const pageMeta = targetPages[i];
      const [copiedPage] = await exportDoc.copyPages(srcDoc, [pageMeta.originalPageIndex]);
      const addedPage = exportDoc.addPage(copiedPage);

      const origRotation = copiedPage.getRotation().angle;
      const totalRotation = ((origRotation + pageMeta.rotation) % 360 + 360) % 360;
      addedPage.setRotation(degrees(totalRotation));

      const unrotatedWidth = addedPage.getWidth();
      const unrotatedHeight = addedPage.getHeight();

      // Find all annotations belonging to this page
      const pageAnnotations = annotations
        .filter((a) => a.pageIndex === pageMeta.pageIndex)
        .sort((a, b) => a.zIndex - b.zIndex);

      for (const ann of pageAnnotations) {
        if (ann.type === 'text') {
          await this.renderTextAnnotation(
            ann,
            addedPage,
            unrotatedWidth,
            unrotatedHeight,
            totalRotation,
            getFont
          );
        } else if (ann.type === 'image') {
          await this.renderImageAnnotation(
            ann,
            addedPage,
            exportDoc,
            unrotatedWidth,
            unrotatedHeight,
            totalRotation
          );
        } else if (ann.type === 'cover') {
          this.renderCoverAnnotation(
            ann,
            addedPage,
            unrotatedWidth,
            unrotatedHeight,
            totalRotation
          );
        }
      }
    }

    const exportedBytes = await exportDoc.save();
    return exportedBytes;
  }

  /**
   * Helper to download exported PDF in browser.
   */
  downloadPdfBlob(bytes: Uint8Array, fileName: string): void {
    const blob = new Blob([bytes as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  private async renderTextAnnotation(
    ann: TextAnnotation,
    page: PDFPage,
    unrotatedWidth: number,
    unrotatedHeight: number,
    totalRotation: number,
    getFont: (family: StandardFontFamily, bold: boolean, italic: boolean) => Promise<PDFFont>
  ): Promise<void> {
    const font = await getFont(ann.fontFamily, ann.isBold, ann.isItalic);
    const color = this.hexToRgb(ann.color);
    const transform = this.coordinateService.mapAnnotationToPdfCoordinates(
      ann,
      unrotatedWidth,
      unrotatedHeight,
      totalRotation
    );

    // Support multiline text
    const lines = (ann.text || '').split('\n');
    const lineHeight = ann.fontSize * 1.25;

    lines.forEach((line, index) => {
      let xOffset = 0;
      if (ann.align === 'center' || ann.align === 'right') {
        const textWidth = font.widthOfTextAtSize(line, ann.fontSize);
        if (ann.align === 'center') {
          xOffset = Math.max(0, (ann.width - textWidth) / 2);
        } else if (ann.align === 'right') {
          xOffset = Math.max(0, ann.width - textWidth);
        }
      }

      // In PDF coordinate space, each subsequent line is lowered by lineHeight
      const lineYOffset = index * lineHeight;

      page.drawText(line, {
        x: transform.x + xOffset,
        y: transform.y + transform.height - ann.fontSize - lineYOffset,
        size: ann.fontSize,
        font: font,
        color: color,
        opacity: ann.opacity ?? 1.0,
        rotate: degrees(transform.rotationDegrees)
      });
    });
  }

  private async renderImageAnnotation(
    ann: ImageAnnotation,
    page: PDFPage,
    exportDoc: PDFDocument,
    unrotatedWidth: number,
    unrotatedHeight: number,
    totalRotation: number
  ): Promise<void> {
    const transform = this.coordinateService.mapAnnotationToPdfCoordinates(
      ann,
      unrotatedWidth,
      unrotatedHeight,
      totalRotation
    );

    const imageBytes = this.dataUrlToUint8Array(ann.dataUrl);
    let embeddedImage;

    if (ann.mimeType === 'image/png' || ann.dataUrl.startsWith('data:image/png')) {
      embeddedImage = await exportDoc.embedPng(imageBytes);
    } else {
      embeddedImage = await exportDoc.embedJpg(imageBytes);
    }

    page.drawImage(embeddedImage, {
      x: transform.x,
      y: transform.y,
      width: transform.width,
      height: transform.height,
      opacity: ann.opacity ?? 1.0,
      rotate: degrees(transform.rotationDegrees)
    });
  }

  private renderCoverAnnotation(
    ann: CoverAnnotation,
    page: PDFPage,
    unrotatedWidth: number,
    unrotatedHeight: number,
    totalRotation: number
  ): Promise<void> {
    const transform = this.coordinateService.mapAnnotationToPdfCoordinates(
      ann,
      unrotatedWidth,
      unrotatedHeight,
      totalRotation
    );

    const fillColor = this.hexToRgb(ann.fillColor || '#ffffff');
    const borderColor = ann.borderColor ? this.hexToRgb(ann.borderColor) : undefined;

    page.drawRectangle({
      x: transform.x,
      y: transform.y,
      width: transform.width,
      height: transform.height,
      color: fillColor,
      borderColor: borderColor,
      borderWidth: ann.borderWidth ?? 0,
      opacity: ann.opacity ?? 1.0,
      rotate: degrees(transform.rotationDegrees)
    });

    return Promise.resolve();
  }

  private hexToRgb(hex: string): RGB {
    const clean = hex.replace('#', '').trim();
    if (clean.length === 3) {
      const r = parseInt(clean[0] + clean[0], 16) / 255;
      const g = parseInt(clean[1] + clean[1], 16) / 255;
      const b = parseInt(clean[2] + clean[2], 16) / 255;
      return rgb(isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b);
    }
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    return rgb(isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b);
  }

  private dataUrlToUint8Array(dataUrl: string): Uint8Array {
    const base64Part = dataUrl.split(',')[1] || dataUrl;
    const binaryStr = globalThis.atob(base64Part);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  }
}
