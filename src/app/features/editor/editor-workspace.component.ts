import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorStateService } from '../../core/services/editor-state.service';
import { CoordinateService } from '../../core/services/coordinate.service';
import { PdfExportService } from '../../core/services/pdf-export.service';
import { TopToolbarComponent } from './components/top-toolbar.component';
import { PropertyBarComponent } from './components/property-bar.component';
import { SidebarPagesComponent } from './components/sidebar-pages.component';
import { PageCanvasComponent } from './components/page-canvas.component';
import { SignatureDialogComponent } from './components/signature-dialog.component';
import { ConfirmationModalComponent } from '../../shared/components/confirmation-modal.component';
import {
  ExportOptions,
  ImageAnnotation,
  PageMeta
} from '../../core/models/pdf-editor.models';

@Component({
  selector: 'app-editor-workspace',
  standalone: true,
  imports: [
    CommonModule,
    TopToolbarComponent,
    PropertyBarComponent,
    SidebarPagesComponent,
    PageCanvasComponent,
    SignatureDialogComponent,
    ConfirmationModalComponent
  ],
  template: `
    <div class="workspace-container">
      <!-- 1. Top Toolbar -->
      <app-top-toolbar
        [isExporting]="isExporting"
        (openSignatureModal)="isSignatureModalOpen = true"
        (insertImageFile)="onInsertImageFile($event)"
        (exportPdf)="onExportPdf($event)"
        (fitPage)="onFitPage()"
        (fitWidth)="onFitWidth()"
        (requestReset)="onRequestReset()"
      ></app-top-toolbar>

      <!-- 2. Contextual Property Bar -->
      <app-property-bar></app-property-bar>

      <!-- 3. Editor Main Body -->
      <div class="workspace-body" #workspaceBody>
        <!-- Left Pages & Search Sidebar -->
        <app-sidebar-pages
          [pdfDoc]="pdfDoc"
          (requestDeletePage)="onConfirmDeletePage($event)"
        ></app-sidebar-pages>

        <!-- Center Canvas Viewport -->
        <app-page-canvas
          #pageCanvas
          [pdfDoc]="pdfDoc"
          [pageMeta]="state.activePage()"
        ></app-page-canvas>
      </div>

      <!-- Signature Modal Dialog -->
      <app-signature-dialog
        [isOpen]="isSignatureModalOpen"
        (close)="isSignatureModalOpen = false"
        (insertSignature)="onInsertSignature($event)"
      ></app-signature-dialog>

      <!-- Confirmation Modal -->
      <app-confirmation-modal
        [isOpen]="confirmation.isOpen"
        [title]="confirmation.title"
        [message]="confirmation.message"
        [warningText]="confirmation.warning"
        [isDanger]="confirmation.isDanger"
        [confirmText]="confirmation.confirmText"
        (confirm)="onConfirmationApproved()"
        (cancel)="confirmation.isOpen = false"
      ></app-confirmation-modal>
    </div>
  `,
  styles: [`
    .workspace-container {
      display: flex;
      flex-direction: column;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #090d16;
    }
    .workspace-body {
      display: flex;
      flex: 1;
      height: calc(100vh - 104px);
      overflow: hidden;
      position: relative;
    }
  `]
})
export class EditorWorkspaceComponent {
  state = inject(EditorStateService);
  coordinateService = inject(CoordinateService);
  exportService = inject(PdfExportService);

  @Input() pdfDoc: any = null;
  @Output() resetDocument = new EventEmitter<void>();

  @ViewChild('workspaceBody') workspaceBodyRef?: ElementRef<HTMLDivElement>;
  @ViewChild('pageCanvas') pageCanvasComponent?: PageCanvasComponent;

  isSignatureModalOpen = false;
  isExporting = false;

  confirmation = {
    isOpen: false,
    title: '',
    message: '',
    warning: '',
    confirmText: 'Confirm',
    isDanger: false,
    action: () => {}
  };

  @HostListener('window:keydown', ['$event'])
  handleGlobalShortcuts(event: KeyboardEvent): void {
    // Check if user is typing in an input or textarea
    const activeEl = document.activeElement;
    const isInput =
      activeEl instanceof HTMLInputElement ||
      activeEl instanceof HTMLTextAreaElement ||
      activeEl?.getAttribute('contenteditable') === 'true';

    // Undo / Redo (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      if (event.shiftKey) {
        event.preventDefault();
        this.state.redo();
      } else {
        event.preventDefault();
        this.state.undo();
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      this.state.redo();
      return;
    }

    // Export (Ctrl+S / Ctrl+E)
    if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 's' || event.key.toLowerCase() === 'e')) {
      event.preventDefault();
      const docName = this.state.documentInfo()?.name || 'document';
      this.onExportPdf({ scope: 'all', fileName: `${docName.replace(/\.pdf$/i, '')}-edited.pdf` });
      return;
    }

    if (isInput) return;

    // Delete selected element
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const selId = this.state.selectedAnnotationId();
      if (selId) {
        event.preventDefault();
        this.state.deleteAnnotation(selId);
      }
      return;
    }

    // Zoom shortcuts
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.state.zoomIn();
      return;
    }
    if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.state.zoomOut();
      return;
    }
    if (event.key === '0') {
      event.preventDefault();
      this.state.resetZoom();
      return;
    }

    // Tool shortcuts (when not typing in an input)
    if (event.key.toLowerCase() === 'e') {
      event.preventDefault();
      this.state.activeTool.set('edit-text');
      this.state.selectAnnotation(null);
      return;
    }
    if (event.key.toLowerCase() === 'v') {
      event.preventDefault();
      this.state.activeTool.set('select');
      return;
    }
    if (event.key.toLowerCase() === 't') {
      event.preventDefault();
      this.state.activeTool.set('text');
      this.state.selectAnnotation(null);
      return;
    }

    // Deselect with Escape
    if (event.key === 'Escape') {
      this.state.selectAnnotation(null);
    }
  }

  onInsertImageFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const aspect = img.naturalWidth / img.naturalHeight;
        const page = this.state.activePage();
        if (!page) return;

        // Size to reasonable default (e.g. width 180pt)
        const width = 180;
        const height = Math.round(width / aspect);

        // Place near center of page
        const visualDim = this.coordinateService.getVisualDimensions(
          page.width,
          page.height,
          page.rotation
        );
        const x = Math.max(20, Math.round((visualDim.width - width) / 2));
        const y = Math.max(20, Math.round((visualDim.height - height) / 2));

        const imageAnn: ImageAnnotation = {
          id: `img-${Date.now()}`,
          type: 'image',
          pageIndex: page.pageIndex,
          x,
          y,
          width,
          height,
          rotation: 0,
          opacity: 1,
          zIndex: Date.now() % 1000,
          dataUrl,
          mimeType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
          aspectRatio: aspect
        };

        this.state.addAnnotation(imageAnn);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  onInsertSignature(data: { dataUrl: string; aspectRatio: number }): void {
    const page = this.state.activePage();
    if (!page) return;

    const width = 160;
    const height = Math.round(width / (data.aspectRatio || 2));

    const visualDim = this.coordinateService.getVisualDimensions(
      page.width,
      page.height,
      page.rotation
    );
    const x = Math.max(20, Math.round((visualDim.width - width) / 2));
    const y = Math.max(20, Math.round((visualDim.height - height) / 2));

    const sigAnn: ImageAnnotation = {
      id: `sig-${Date.now()}`,
      type: 'image',
      pageIndex: page.pageIndex,
      x,
      y,
      width,
      height,
      rotation: 0,
      opacity: 1,
      zIndex: Date.now() % 1000,
      dataUrl: data.dataUrl,
      mimeType: 'image/png',
      isSignature: true,
      aspectRatio: data.aspectRatio
    };

    this.state.addAnnotation(sigAnn);
  }

  async onExportPdf(options: ExportOptions): Promise<void> {
    const docInfo = this.state.documentInfo();
    if (!docInfo || !docInfo.rawBytes) return;

    this.isExporting = true;
    try {
      const exportedBytes = await this.exportService.exportPdf(
        docInfo.rawBytes,
        this.state.pages(),
        this.state.annotations(),
        options
      );

      const fileName = options.fileName || 'document-edited.pdf';
      this.exportService.downloadPdfBlob(exportedBytes, fileName);
    } catch (err: any) {
      console.error('PDF Export failed:', err);
      alert(`Export failed: ${err.message || 'Unknown error'}`);
    } finally {
      this.isExporting = false;
    }
  }

  onFitPage(): void {
    const page = this.state.activePage();
    const bodyEl = this.workspaceBodyRef?.nativeElement;
    if (!page || !bodyEl) return;

    const visualDim = this.coordinateService.getVisualDimensions(
      page.width,
      page.height,
      page.rotation
    );

    const zoom = this.coordinateService.calculateFitZoom(
      visualDim.width,
      visualDim.height,
      bodyEl.clientWidth - 240, // Account for sidebar
      bodyEl.clientHeight,
      'page',
      60
    );

    this.state.setZoom(zoom);
  }

  onFitWidth(): void {
    const page = this.state.activePage();
    const bodyEl = this.workspaceBodyRef?.nativeElement;
    if (!page || !bodyEl) return;

    const visualDim = this.coordinateService.getVisualDimensions(
      page.width,
      page.height,
      page.rotation
    );

    const zoom = this.coordinateService.calculateFitZoom(
      visualDim.width,
      visualDim.height,
      bodyEl.clientWidth - 240,
      bodyEl.clientHeight,
      'width',
      60
    );

    this.state.setZoom(zoom);
  }

  onConfirmDeletePage(page: PageMeta): void {
    this.confirmation = {
      isOpen: true,
      title: `Delete Page ${page.pageNumber}?`,
      message: `Are you sure you want to remove Page ${page.pageNumber} from this document?`,
      warning: 'You can restore this page before exporting using Undo (Ctrl+Z).',
      confirmText: 'Delete Page',
      isDanger: true,
      action: () => {
        this.state.deletePage(page.pageIndex);
      }
    };
  }

  onRequestReset(): void {
    this.confirmation = {
      isOpen: true,
      title: 'Close Document?',
      message: 'Are you sure you want to close this document? Unsaved changes will be discarded.',
      warning: 'Make sure you have exported your work before leaving.',
      confirmText: 'Close & Discard',
      isDanger: true,
      action: () => {
        this.state.resetDocument();
        this.resetDocument.emit();
      }
    };
  }

  onConfirmationApproved(): void {
    this.confirmation.isOpen = false;
    this.confirmation.action();
  }
}
