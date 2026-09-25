import { Injectable } from '@angular/core';
import { Annotation } from '../models/pdf-editor.models';

export interface VisualDimensions {
  width: number;
  height: number;
}

export interface PdfElementTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDegrees: number; // counter-clockwise degrees for pdf-lib
}

@Injectable({
  providedIn: 'root'
})
export class CoordinateService {
  /**
   * Get the visual width and height of a page taking into account its rotation.
   * @param unrotatedWidth Native PDF page width in points
   * @param unrotatedHeight Native PDF page height in points
   * @param rotation Clockwise rotation in degrees (0, 90, 180, 270)
   */
  getVisualDimensions(
    unrotatedWidth: number,
    unrotatedHeight: number,
    rotation: number
  ): VisualDimensions {
    const normalizedRotation = ((rotation % 360) + 360) % 360;
    if (normalizedRotation === 90 || normalizedRotation === 270) {
      return { width: unrotatedHeight, height: unrotatedWidth };
    }
    return { width: unrotatedWidth, height: unrotatedHeight };
  }

  /**
   * Convert screen/DOM pixel coordinates to unscaled PDF points.
   */
  screenToPdfPoints(screenCoord: number, zoom: number): number {
    if (zoom <= 0) return 0;
    return screenCoord / zoom;
  }

  /**
   * Convert unscaled PDF points to screen/DOM pixel coordinates.
   */
  pdfPointsToScreen(pdfPoint: number, zoom: number): number {
    return pdfPoint * zoom;
  }

  /**
   * Maps an annotation from visual page coordinates (origin top-left of displayed page)
   * to pdf-lib page coordinate space (origin bottom-left of unrotated MediaBox, accounting
   * for the page's intrinsic display rotation).
   */
  mapAnnotationToPdfCoordinates(
    annotation: Pick<Annotation, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
    unrotatedWidth: number,
    unrotatedHeight: number,
    pageRotation: number
  ): PdfElementTransform {
    const W = unrotatedWidth;
    const H = unrotatedHeight;
    const { x, y, width: w, height: h } = annotation;
    const userTheta = annotation.rotation || 0;
    const normRot = ((pageRotation % 360) + 360) % 360;

    let pdfX: number;
    let pdfY: number;
    let anglePdfLib: number;

    switch (normRot) {
      case 90:
        // Page rotated 90 deg clockwise.
        // Visual top-left is at (0, 0) unrotated.
        pdfX = y;
        pdfY = x + w;
        anglePdfLib = -90 - userTheta;
        break;

      case 180:
        // Page rotated 180 deg clockwise.
        pdfX = W - x;
        pdfY = y + h;
        anglePdfLib = -180 - userTheta;
        break;

      case 270:
        // Page rotated 270 deg clockwise (90 deg counter-clockwise).
        pdfX = y + h;
        pdfY = H - x - w;
        anglePdfLib = 90 - userTheta;
        break;

      case 0:
      default:
        // Unrotated page: origin is bottom-left, y increases upwards.
        pdfX = x;
        pdfY = H - y - h;
        anglePdfLib = -userTheta;
        break;
    }

    // Normalize angle to [-360, 360]
    const normalizedAngle = ((anglePdfLib % 360) + 360) % 360;

    return {
      x: pdfX,
      y: pdfY,
      width: w,
      height: h,
      rotationDegrees: normalizedAngle
    };
  }

  /**
   * Calculates ideal zoom factor to fit page into the available viewport.
   * @param visualWidth Page visual width in points
   * @param visualHeight Page visual height in points
   * @param viewportWidth Available container width in pixels
   * @param viewportHeight Available container height in pixels
   * @param mode 'width' (fit width with padding) or 'page' (fit entire page inside container)
   * @param padding Padding around page in pixels (default 40)
   */
  calculateFitZoom(
    visualWidth: number,
    visualHeight: number,
    viewportWidth: number,
    viewportHeight: number,
    mode: 'width' | 'page' = 'page',
    padding: number = 40
  ): number {
    const availableW = Math.max(100, viewportWidth - padding);
    const availableH = Math.max(100, viewportHeight - padding);

    const zoomW = availableW / visualWidth;
    const zoomH = availableH / visualHeight;

    let zoom: number;
    if (mode === 'width') {
      zoom = zoomW;
    } else {
      zoom = Math.min(zoomW, zoomH);
    }

    // Clamp zoom between 25% (0.25) and 400% (4.0)
    return Math.max(0.25, Math.min(4.0, Math.round(zoom * 100) / 100));
  }
}
