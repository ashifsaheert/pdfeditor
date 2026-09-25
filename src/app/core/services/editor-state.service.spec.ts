import { describe, it, expect, beforeEach } from 'vitest';
import { EditorStateService } from './editor-state.service';
import { PageMeta, TextAnnotation } from '../models/pdf-editor.models';

describe('EditorStateService', () => {
  let stateService: EditorStateService;

  const mockPages: PageMeta[] = [
    { pageIndex: 0, originalPageIndex: 0, pageNumber: 1, width: 612, height: 792, rotation: 0 },
    { pageIndex: 1, originalPageIndex: 1, pageNumber: 2, width: 612, height: 792, rotation: 0 },
    { pageIndex: 2, originalPageIndex: 2, pageNumber: 3, width: 612, height: 792, rotation: 0 }
  ];

  beforeEach(() => {
    stateService = new EditorStateService();
    stateService.setDocument(
      { name: 'test.pdf', sizeBytes: 1024, pageCount: 3, rawBytes: new Uint8Array() },
      [...mockPages]
    );
  });

  describe('Document and Page State', () => {
    it('should initialize with correct active page and count', () => {
      expect(stateService.activePages().length).toBe(3);
      expect(stateService.activePage()?.pageIndex).toBe(0);
      expect(stateService.canUndo()).toBe(false);
      expect(stateService.canRedo()).toBe(false);
    });

    it('should navigate pages correctly', () => {
      stateService.nextPage();
      expect(stateService.activePageIndex()).toBe(1);

      stateService.nextPage();
      expect(stateService.activePageIndex()).toBe(2);

      // Should not exceed bounds
      stateService.nextPage();
      expect(stateService.activePageIndex()).toBe(2);

      stateService.prevPage();
      expect(stateService.activePageIndex()).toBe(1);
    });
  });

  describe('Annotation Operations & Undo/Redo', () => {
    const sampleText: TextAnnotation = {
      id: 'ann-1',
      type: 'text',
      pageIndex: 0,
      x: 50,
      y: 50,
      width: 100,
      height: 30,
      rotation: 0,
      opacity: 1,
      zIndex: 1,
      text: 'Test',
      fontSize: 14,
      fontFamily: 'Helvetica',
      color: '#000000',
      isBold: false,
      isItalic: false,
      align: 'left'
    };

    it('should add annotation and support undo/redo', () => {
      stateService.addAnnotation(sampleText);
      expect(stateService.annotations().length).toBe(1);
      expect(stateService.canUndo()).toBe(true);

      // Undo addition
      stateService.undo();
      expect(stateService.annotations().length).toBe(0);
      expect(stateService.canRedo()).toBe(true);

      // Redo addition
      stateService.redo();
      expect(stateService.annotations().length).toBe(1);
      expect(stateService.annotations()[0].id).toBe('ann-1');
    });

    it('should update annotation and support undo/redo', () => {
      stateService.addAnnotation(sampleText);
      stateService.updateAnnotation('ann-1', { text: 'Updated Text', fontSize: 20 });

      expect((stateService.annotations()[0] as TextAnnotation).text).toBe('Updated Text');
      expect((stateService.annotations()[0] as TextAnnotation).fontSize).toBe(20);

      // Undo update
      stateService.undo();
      expect((stateService.annotations()[0] as TextAnnotation).text).toBe('Test');
      expect((stateService.annotations()[0] as TextAnnotation).fontSize).toBe(14);

      // Redo update
      stateService.redo();
      expect((stateService.annotations()[0] as TextAnnotation).text).toBe('Updated Text');
    });

    it('should delete annotation and support undo/redo', () => {
      stateService.addAnnotation(sampleText);
      stateService.deleteAnnotation('ann-1');
      expect(stateService.annotations().length).toBe(0);

      // Undo deletion restores it
      stateService.undo();
      expect(stateService.annotations().length).toBe(1);
      expect(stateService.annotations()[0].id).toBe('ann-1');

      // Redo re-deletes it
      stateService.redo();
      expect(stateService.annotations().length).toBe(0);
    });
  });

  describe('Page Operations & History', () => {
    it('should rotate page and undo/redo', () => {
      stateService.rotatePage(0, 90);
      expect(stateService.pages()[0].rotation).toBe(90);

      stateService.undo();
      expect(stateService.pages()[0].rotation).toBe(0);

      stateService.redo();
      expect(stateService.pages()[0].rotation).toBe(90);
    });

    it('should delete page and undo/redo', () => {
      stateService.deletePage(1);
      expect(stateService.activePages().length).toBe(2);

      stateService.undo();
      expect(stateService.activePages().length).toBe(3);

      stateService.redo();
      expect(stateService.activePages().length).toBe(2);
    });

    it('should reorder pages correctly', () => {
      // Move page 0 to index 2
      stateService.reorderPages(0, 2);
      const active = stateService.activePages();
      expect(active[0].originalPageIndex).toBe(1);
      expect(active[1].originalPageIndex).toBe(2);
      expect(active[2].originalPageIndex).toBe(0);

      // Undo reorder
      stateService.undo();
      const restored = stateService.activePages();
      expect(restored[0].originalPageIndex).toBe(0);
      expect(restored[1].originalPageIndex).toBe(1);
      expect(restored[2].originalPageIndex).toBe(2);
    });
  });

  describe('Zoom controls', () => {
    it('should zoom in and zoom out within limits', () => {
      stateService.setZoom(1.0);
      stateService.zoomIn();
      expect(stateService.zoom()).toBe(1.15);

      stateService.zoomOut();
      expect(stateService.zoom()).toBe(1.0);

      // Minimum clamp
      stateService.setZoom(0.1);
      expect(stateService.zoom()).toBe(0.25);

      // Maximum clamp
      stateService.setZoom(5.0);
      expect(stateService.zoom()).toBe(4.0);
    });
  });

  describe('Search navigation', () => {
    it('should cycle through search matches', () => {
      const matches = [
        { pageIndex: 0, matchIndex: 0, textSnippet: 'first match' },
        { pageIndex: 2, matchIndex: 1, textSnippet: 'second match' }
      ];

      stateService.setSearchQuery('test', matches);
      expect(stateService.currentMatchIndex()).toBe(0);
      expect(stateService.activePageIndex()).toBe(0);

      stateService.nextSearchMatch();
      expect(stateService.currentMatchIndex()).toBe(1);
      expect(stateService.activePageIndex()).toBe(2);

      // Wrap around
      stateService.nextSearchMatch();
      expect(stateService.currentMatchIndex()).toBe(0);
      expect(stateService.activePageIndex()).toBe(0);

      // Previous match wrap around
      stateService.prevSearchMatch();
      expect(stateService.currentMatchIndex()).toBe(1);
      expect(stateService.activePageIndex()).toBe(2);
    });
  });
});
