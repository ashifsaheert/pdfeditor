import { Injectable, computed, signal } from '@angular/core';
import {
  Annotation,
  DocumentInfo,
  EditorAction,
  EditorTool,
  PageMeta,
  SearchMatch
} from '../models/pdf-editor.models';

const MAX_HISTORY_DEPTH = 50;

@Injectable({
  providedIn: 'root'
})
export class EditorStateService {
  // Document state
  readonly documentInfo = signal<DocumentInfo | null>(null);
  readonly pages = signal<PageMeta[]>([]);
  readonly activePageIndex = signal<number>(0);
  readonly annotations = signal<Annotation[]>([]);
  readonly selectedAnnotationId = signal<string | null>(null);

  // Tool & Viewport state
  readonly activeTool = signal<EditorTool>('select');
  readonly zoom = signal<number>(1.0);
  readonly fitMode = signal<'page' | 'width' | null>(null);

  // Status & Progress
  readonly isLoading = signal<boolean>(false);
  readonly loadingMessage = signal<string>('');
  readonly errorMessage = signal<string | null>(null);

  // Undo / Redo history
  readonly undoStack = signal<EditorAction[]>([]);
  readonly redoStack = signal<EditorAction[]>([]);

  // Search state
  readonly searchQuery = signal<string>('');
  readonly searchMatches = signal<SearchMatch[]>([]);
  readonly currentMatchIndex = signal<number>(-1);

  // Computed signals
  readonly activePages = computed(() => this.pages().filter((p) => !p.isDeleted));

  readonly activePage = computed(() => {
    const pages = this.activePages();
    const idx = this.activePageIndex();
    return pages[idx] ?? null;
  });

  readonly activePageAnnotations = computed(() => {
    const page = this.activePage();
    if (!page) return [];
    return this.annotations().filter((a) => a.pageIndex === page.pageIndex);
  });

  readonly selectedAnnotation = computed(() => {
    const selId = this.selectedAnnotationId();
    if (!selId) return null;
    return this.annotations().find((a) => a.id === selId) ?? null;
  });

  readonly canUndo = computed(() => this.undoStack().length > 0);
  readonly canRedo = computed(() => this.redoStack().length > 0);

  /**
   * Initialize a new document in the editor state.
   */
  setDocument(docInfo: DocumentInfo, initialPages: PageMeta[]): void {
    this.documentInfo.set(docInfo);
    this.pages.set(initialPages);
    this.activePageIndex.set(0);
    this.annotations.set([]);
    this.selectedAnnotationId.set(null);
    this.undoStack.set([]);
    this.redoStack.set([]);
    this.zoom.set(1.0);
    this.fitMode.set(null);
    this.searchQuery.set('');
    this.searchMatches.set([]);
    this.currentMatchIndex.set(-1);
    this.errorMessage.set(null);
  }

  /**
   * Reset / Close document.
   */
  resetDocument(): void {
    this.documentInfo.set(null);
    this.pages.set([]);
    this.activePageIndex.set(0);
    this.annotations.set([]);
    this.selectedAnnotationId.set(null);
    this.undoStack.set([]);
    this.redoStack.set([]);
  }

  // ==========================================
  // ANNOTATION OPERATIONS
  // ==========================================

  addAnnotation(annotation: Annotation, trackHistory = true): void {
    const current = this.annotations();
    this.annotations.set([...current, annotation]);
    this.selectedAnnotationId.set(annotation.id);

    if (trackHistory) {
      this.pushAction({
        id: `add-${annotation.id}`,
        description: `Add ${annotation.type}`,
        undo: () => this.deleteAnnotation(annotation.id, false),
        redo: () => this.addAnnotation(annotation, false)
      });
    }
  }

  updateAnnotation(id: string, updates: Partial<Annotation>, trackHistory = true): void {
    const currentList = this.annotations();
    const existing = currentList.find((a) => a.id === id);
    if (!existing) return;

    const previousState = { ...existing };
    const updated = { ...existing, ...updates } as Annotation;

    this.annotations.set(currentList.map((a) => (a.id === id ? updated : a)));

    if (trackHistory) {
      this.pushAction({
        id: `update-${id}-${Date.now()}`,
        description: `Update ${existing.type}`,
        undo: () => this.updateAnnotation(id, previousState, false),
        redo: () => this.updateAnnotation(id, updates, false)
      });
    }
  }

  deleteAnnotation(id: string, trackHistory = true): void {
    const currentList = this.annotations();
    const existing = currentList.find((a) => a.id === id);
    if (!existing) return;

    if (this.selectedAnnotationId() === id) {
      this.selectedAnnotationId.set(null);
    }

    this.annotations.set(currentList.filter((a) => a.id !== id));

    if (trackHistory) {
      this.pushAction({
        id: `delete-${id}`,
        description: `Delete ${existing.type}`,
        undo: () => this.addAnnotation(existing, false),
        redo: () => this.deleteAnnotation(id, false)
      });
    }
  }

  bringToFront(id: string): void {
    const list = this.annotations();
    const item = list.find((a) => a.id === id);
    if (!item) return;

    const maxZ = Math.max(0, ...list.map((a) => a.zIndex || 0));
    this.updateAnnotation(id, { zIndex: maxZ + 1 });
  }

  sendToBack(id: string): void {
    const list = this.annotations();
    const item = list.find((a) => a.id === id);
    if (!item) return;

    const minZ = Math.min(0, ...list.map((a) => a.zIndex || 0));
    this.updateAnnotation(id, { zIndex: minZ - 1 });
  }

  selectAnnotation(id: string | null): void {
    this.selectedAnnotationId.set(id);
    if (id) {
      this.activeTool.set('select');
    }
  }

  // ==========================================
  // PAGE OPERATIONS
  // ==========================================

  rotatePage(pageIndex: number, deltaDegrees: 90 | -90 | 180, trackHistory = true): void {
    const currentPages = this.pages();
    const target = currentPages.find((p) => p.pageIndex === pageIndex);
    if (!target) return;

    const prevRot = target.rotation;
    const newRot = ((target.rotation + deltaDegrees) % 360 + 360) % 360;

    this.pages.set(
      currentPages.map((p) => (p.pageIndex === pageIndex ? { ...p, rotation: newRot } : p))
    );

    if (trackHistory) {
      this.pushAction({
        id: `rotate-page-${pageIndex}-${Date.now()}`,
        description: `Rotate page ${target.pageNumber}`,
        undo: () => {
          this.pages.set(
            this.pages().map((p) => (p.pageIndex === pageIndex ? { ...p, rotation: prevRot } : p))
          );
        },
        redo: () => {
          this.pages.set(
            this.pages().map((p) => (p.pageIndex === pageIndex ? { ...p, rotation: newRot } : p))
          );
        }
      });
    }
  }

  deletePage(pageIndex: number, trackHistory = true): void {
    const currentPages = this.pages();
    const target = currentPages.find((p) => p.pageIndex === pageIndex);
    if (!target || target.isDeleted) return;

    // Preserve annotations on that page in case of undo
    const affectedAnnotations = this.annotations().filter((a) => a.pageIndex === pageIndex);

    this.pages.set(
      currentPages.map((p) => (p.pageIndex === pageIndex ? { ...p, isDeleted: true } : p))
    );

    // Adjust active page index if needed
    const remaining = this.activePages();
    const currentActive = this.activePageIndex();
    if (currentActive >= remaining.length) {
      this.activePageIndex.set(Math.max(0, remaining.length - 1));
    }

    if (trackHistory) {
      this.pushAction({
        id: `delete-page-${pageIndex}`,
        description: `Delete page ${target.pageNumber}`,
        undo: () => {
          this.pages.set(
            this.pages().map((p) => (p.pageIndex === pageIndex ? { ...p, isDeleted: false } : p))
          );
        },
        redo: () => this.deletePage(pageIndex, false)
      });
    }
  }

  reorderPages(fromVisualIndex: number, toVisualIndex: number, trackHistory = true): void {
    const currentActive = [...this.activePages()];
    if (
      fromVisualIndex < 0 ||
      fromVisualIndex >= currentActive.length ||
      toVisualIndex < 0 ||
      toVisualIndex >= currentActive.length ||
      fromVisualIndex === toVisualIndex
    ) {
      return;
    }

    const [moved] = currentActive.splice(fromVisualIndex, 1);
    currentActive.splice(toVisualIndex, 0, moved);

    // Re-index display pageNumber
    const reordered = currentActive.map((p, idx) => ({
      ...p,
      pageNumber: idx + 1
    }));

    // Update state keeping any deleted pages intact in backing storage
    const deletedPages = this.pages().filter((p) => p.isDeleted);
    this.pages.set([...reordered, ...deletedPages]);
    this.activePageIndex.set(toVisualIndex);

    if (trackHistory) {
      this.pushAction({
        id: `reorder-pages-${Date.now()}`,
        description: `Move page ${fromVisualIndex + 1} to ${toVisualIndex + 1}`,
        undo: () => this.reorderPages(toVisualIndex, fromVisualIndex, false),
        redo: () => this.reorderPages(fromVisualIndex, toVisualIndex, false)
      });
    }
  }

  setActivePageIndex(index: number): void {
    const count = this.activePages().length;
    if (index >= 0 && index < count) {
      this.activePageIndex.set(index);
      this.selectedAnnotationId.set(null);
    }
  }

  nextPage(): void {
    const current = this.activePageIndex();
    if (current < this.activePages().length - 1) {
      this.setActivePageIndex(current + 1);
    }
  }

  prevPage(): void {
    const current = this.activePageIndex();
    if (current > 0) {
      this.setActivePageIndex(current - 1);
    }
  }

  // ==========================================
  // ZOOM CONTROLS
  // ==========================================

  setZoom(value: number): void {
    const clamped = Math.max(0.25, Math.min(4.0, Math.round(value * 100) / 100));
    this.zoom.set(clamped);
    this.fitMode.set(null);
  }

  zoomIn(): void {
    this.setZoom(this.zoom() + 0.15);
  }

  zoomOut(): void {
    this.setZoom(this.zoom() - 0.15);
  }

  resetZoom(): void {
    this.setZoom(1.0);
  }

  setFitMode(mode: 'page' | 'width' | null): void {
    this.fitMode.set(mode);
  }

  // ==========================================
  // UNDO / REDO COMMAND PATTERN
  // ==========================================

  pushAction(action: EditorAction): void {
    const stack = [...this.undoStack(), action];
    if (stack.length > MAX_HISTORY_DEPTH) {
      stack.shift();
    }
    this.undoStack.set(stack);
    this.redoStack.set([]); // Clear redo stack on new action
  }

  undo(): void {
    const stack = [...this.undoStack()];
    const action = stack.pop();
    if (!action) return;

    this.undoStack.set(stack);
    action.undo();

    const redos = [...this.redoStack(), action];
    this.redoStack.set(redos);
  }

  redo(): void {
    const stack = [...this.redoStack()];
    const action = stack.pop();
    if (!action) return;

    this.redoStack.set(stack);
    action.redo();

    const undos = [...this.undoStack(), action];
    this.undoStack.set(undos);
  }

  // ==========================================
  // SEARCH FUNCTIONALITY
  // ==========================================

  setSearchQuery(query: string, matches: SearchMatch[]): void {
    this.searchQuery.set(query);
    this.searchMatches.set(matches);
    if (matches.length > 0) {
      this.currentMatchIndex.set(0);
      this.setActivePageIndex(matches[0].pageIndex);
    } else {
      this.currentMatchIndex.set(-1);
    }
  }

  nextSearchMatch(): void {
    const matches = this.searchMatches();
    if (matches.length === 0) return;
    const nextIdx = (this.currentMatchIndex() + 1) % matches.length;
    this.currentMatchIndex.set(nextIdx);
    this.setActivePageIndex(matches[nextIdx].pageIndex);
  }

  prevSearchMatch(): void {
    const matches = this.searchMatches();
    if (matches.length === 0) return;
    const current = this.currentMatchIndex();
    const prevIdx = (current - 1 + matches.length) % matches.length;
    this.currentMatchIndex.set(prevIdx);
    this.setActivePageIndex(matches[prevIdx].pageIndex);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchMatches.set([]);
    this.currentMatchIndex.set(-1);
  }
}
