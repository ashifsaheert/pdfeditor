import { describe, it, expect, beforeEach } from 'vitest';
import { CoordinateService } from './coordinate.service';

describe('CoordinateService', () => {
  let service: CoordinateService;

  beforeEach(() => {
    service = new CoordinateService();
  });

  describe('getVisualDimensions', () => {
    it('should return unrotated dimensions for 0 and 360 degrees', () => {
      const dim0 = service.getVisualDimensions(612, 792, 0);
      expect(dim0).toEqual({ width: 612, height: 792 });

      const dim360 = service.getVisualDimensions(612, 792, 360);
      expect(dim360).toEqual({ width: 612, height: 792 });
    });

    it('should swap width and height for 90 and 270 degrees', () => {
      const dim90 = service.getVisualDimensions(612, 792, 90);
      expect(dim90).toEqual({ width: 792, height: 612 });

      const dim270 = service.getVisualDimensions(612, 792, 270);
      expect(dim270).toEqual({ width: 792, height: 612 });

      const dimNeg90 = service.getVisualDimensions(612, 792, -90);
      expect(dimNeg90).toEqual({ width: 792, height: 612 });
    });

    it('should keep orientation for 180 degrees', () => {
      const dim180 = service.getVisualDimensions(612, 792, 180);
      expect(dim180).toEqual({ width: 612, height: 792 });
    });
  });

  describe('Screen to PDF and PDF to Screen conversions', () => {
    it('should convert screen coordinates to PDF points accurately across zoom levels', () => {
      // Zoom 1.0
      expect(service.screenToPdfPoints(150, 1.0)).toBe(150);
      // Zoom 2.0 (screen 200px -> 100pt)
      expect(service.screenToPdfPoints(200, 2.0)).toBe(100);
      // Zoom 0.5 (screen 100px -> 200pt)
      expect(service.screenToPdfPoints(100, 0.5)).toBe(200);
    });

    it('should convert PDF points to screen coordinates accurately across zoom levels', () => {
      expect(service.pdfPointsToScreen(100, 1.0)).toBe(100);
      expect(service.pdfPointsToScreen(100, 1.5)).toBe(150);
      expect(service.pdfPointsToScreen(100, 0.25)).toBe(25);
    });

    it('should be reversible without drift', () => {
      const originalPt = 173.45;
      const zoom = 1.33;
      const screen = service.pdfPointsToScreen(originalPt, zoom);
      const recoveredPt = service.screenToPdfPoints(screen, zoom);
      expect(recoveredPt).toBeCloseTo(originalPt, 5);
    });
  });

  describe('mapAnnotationToPdfCoordinates', () => {
    const W = 600;
    const H = 800;
    const annotation = {
      x: 50,
      y: 100,
      width: 200,
      height: 80,
      rotation: 0
    };

    it('should map coordinates correctly for 0 deg rotation (inverted Y axis)', () => {
      const result = service.mapAnnotationToPdfCoordinates(annotation, W, H, 0);
      expect(result.x).toBe(50);
      // In PDF, y = H - visualY - height = 800 - 100 - 80 = 620
      expect(result.y).toBe(620);
      expect(result.width).toBe(200);
      expect(result.height).toBe(80);
      expect(result.rotationDegrees).toBe(0);
    });

    it('should map coordinates correctly for 90 deg rotation', () => {
      const result = service.mapAnnotationToPdfCoordinates(annotation, W, H, 90);
      expect(result.x).toBe(100); // y
      expect(result.y).toBe(250); // x + w = 50 + 200 = 250
      expect(result.rotationDegrees).toBe(270); // -90 deg normalized
    });

    it('should map coordinates correctly for 180 deg rotation', () => {
      const result = service.mapAnnotationToPdfCoordinates(annotation, W, H, 180);
      expect(result.x).toBe(550); // W - x = 600 - 50 = 550
      expect(result.y).toBe(180); // y + h = 100 + 80 = 180
      expect(result.rotationDegrees).toBe(180);
    });

    it('should map coordinates correctly for 270 deg rotation', () => {
      const result = service.mapAnnotationToPdfCoordinates(annotation, W, H, 270);
      expect(result.x).toBe(180); // y + h = 100 + 80 = 180
      expect(result.y).toBe(550); // H - x - w = 800 - 50 - 200 = 550
      expect(result.rotationDegrees).toBe(90);
    });

    it('should factor in custom annotation rotation', () => {
      const rotatedAnnotation = { ...annotation, rotation: 45 };
      const res0 = service.mapAnnotationToPdfCoordinates(rotatedAnnotation, W, H, 0);
      expect(res0.rotationDegrees).toBe(315); // -45 normalized
    });
  });

  describe('calculateFitZoom', () => {
    it('should calculate fit page zoom correctly', () => {
      // Page is 600x800, container is 1200x1000 with 40 padding -> available 1160x960
      // zoomW = 1160 / 600 = 1.93, zoomH = 960 / 800 = 1.2
      // min is 1.2
      const zoom = service.calculateFitZoom(600, 800, 1200, 1000, 'page', 40);
      expect(zoom).toBe(1.2);
    });

    it('should calculate fit width zoom correctly', () => {
      // available width 1160 / 600 = 1.93
      const zoom = service.calculateFitZoom(600, 800, 1200, 1000, 'width', 40);
      expect(zoom).toBe(1.93);
    });

    it('should clamp zoom to minimum 0.25 and maximum 4.0', () => {
      const tinyZoom = service.calculateFitZoom(10000, 10000, 500, 500, 'page');
      expect(tinyZoom).toBe(0.25);

      const hugeZoom = service.calculateFitZoom(50, 50, 2000, 2000, 'page');
      expect(hugeZoom).toBe(4.0);
    });
  });
});
