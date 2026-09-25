import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EditorStateService } from '../../../core/services/editor-state.service';
import { EditorTool, ExportOptions } from '../../../core/models/pdf-editor.models';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-top-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <header class="toolbar">
      <!-- Left: Logo & File Info -->
      <div class="toolbar-left">
        <div class="brand">
          <div class="brand-icon">
            <app-icon name="file-pdf" [size]="18"></app-icon>
          </div>
          <span class="brand-name">PDF Studio</span>
        </div>

        <div class="divider"></div>

        <div class="doc-info" *ngIf="state.documentInfo() as doc">
          <span class="doc-name" [title]="doc.name">{{ doc.name }}</span>
          <span class="doc-meta">
            {{ formatBytes(doc.sizeBytes) }} • {{ state.activePages().length }} pages
          </span>
        </div>
      </div>

      <!-- Center: Undo/Redo & Tool Selector -->
      <div class="toolbar-center">
        <!-- History Buttons -->
        <div class="btn-group">
          <button
            type="button"
            class="tool-btn"
            [disabled]="!state.canUndo()"
            (click)="state.undo()"
            title="Undo (Ctrl+Z)"
          >
            <app-icon name="undo" [size]="15"></app-icon>
          </button>
          <button
            type="button"
            class="tool-btn"
            [disabled]="!state.canRedo()"
            (click)="state.redo()"
            title="Redo (Ctrl+Y)"
          >
            <app-icon name="redo" [size]="15"></app-icon>
          </button>
        </div>

        <div class="divider"></div>

        <!-- Primary Tools -->
        <div class="btn-group tool-selector">
          <button
            type="button"
            class="tool-btn"
            [class.active]="state.activeTool() === 'select'"
            (click)="setTool('select')"
            title="Select & Move Tool (V)"
          >
            <app-icon name="select" [size]="15"></app-icon>
            <span class="tool-label">Select</span>
          </button>

          <button
            type="button"
            class="tool-btn edit-text-btn"
            [class.active]="state.activeTool() === 'edit-text'"
            (click)="setTool('edit-text')"
            title="Select & Edit Existing PDF Text (E)"
          >
            <app-icon name="edit-text" [size]="15"></app-icon>
            <span class="tool-label">Edit Text</span>
          </button>

          <button
            type="button"
            class="tool-btn"
            [class.active]="state.activeTool() === 'text'"
            (click)="setTool('text')"
            title="Add Text Annotation (T)"
          >
            <app-icon name="text" [size]="15"></app-icon>
            <span class="tool-label">Text</span>
          </button>

          <button
            type="button"
            class="tool-btn"
            (click)="imageFileInput.click()"
            title="Insert PNG/JPG Image"
          >
            <input
              #imageFileInput
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style="display: none"
              (change)="onImageFileSelected($event)"
            />
            <app-icon name="image" [size]="15"></app-icon>
            <span class="tool-label">Image</span>
          </button>

          <button
            type="button"
            class="tool-btn"
            (click)="openSignatureModal.emit()"
            title="Insert Signature (Draw or Upload)"
          >
            <app-icon name="signature" [size]="15"></app-icon>
            <span class="tool-label">Signature</span>
          </button>

          <button
            type="button"
            class="tool-btn cover-btn"
            [class.active]="state.activeTool() === 'cover'"
            (click)="setTool('cover')"
            title="Visual Cover-up / Redaction (Cover content with white rectangle)"
          >
            <app-icon name="cover" [size]="15"></app-icon>
            <span class="tool-label">Cover-up</span>
          </button>
        </div>

        <div class="divider"></div>

        <!-- Zoom Controls -->
        <div class="btn-group zoom-controls">
          <button
            type="button"
            class="tool-btn"
            (click)="state.zoomOut()"
            title="Zoom Out (-)"
          >
            <app-icon name="zoom-out" [size]="15"></app-icon>
          </button>

          <select
            class="zoom-select"
            [ngModel]="currentZoomPercent"
            (ngModelChange)="onZoomPercentChange($event)"
            title="Zoom Level"
          >
            <option value="50">50%</option>
            <option value="75">75%</option>
            <option value="100">100%</option>
            <option value="125">125%</option>
            <option value="150">150%</option>
            <option value="200">200%</option>
          </select>

          <button
            type="button"
            class="tool-btn"
            (click)="state.zoomIn()"
            title="Zoom In (+)"
          >
            <app-icon name="zoom-in" [size]="15"></app-icon>
          </button>

          <button
            type="button"
            class="tool-btn"
            (click)="fitPage.emit()"
            title="Fit Entire Page"
          >
            <app-icon name="fit-page" [size]="15"></app-icon>
          </button>

          <button
            type="button"
            class="tool-btn"
            (click)="fitWidth.emit()"
            title="Fit Page Width"
          >
            <app-icon name="fit-width" [size]="15"></app-icon>
          </button>
        </div>
      </div>

      <!-- Right: Page Nav & Export Button -->
      <div class="toolbar-right">
        <!-- Page Nav -->
        <div class="page-stepper" *ngIf="state.activePages().length > 0">
          <button
            type="button"
            class="btn-step"
            [disabled]="state.activePageIndex() <= 0"
            (click)="state.prevPage()"
            title="Previous Page"
          >
            <app-icon name="chevron-left" [size]="14"></app-icon>
          </button>
          <span class="page-indicator">
            {{ state.activePageIndex() + 1 }} / {{ state.activePages().length }}
          </span>
          <button
            type="button"
            class="btn-step"
            [disabled]="state.activePageIndex() >= state.activePages().length - 1"
            (click)="state.nextPage()"
            title="Next Page"
          >
            <app-icon name="chevron-right" [size]="14"></app-icon>
          </button>
        </div>

        <div class="divider"></div>

        <!-- Export Dropdown -->
        <div class="export-dropdown-wrap">
          <button
            type="button"
            class="btn btn-export"
            (click)="triggerExport('all')"
            [disabled]="isExporting"
            title="Export full edited PDF"
          >
            <app-icon name="download" [size]="15"></app-icon>
            <span>{{ isExporting ? 'Exporting...' : 'Export PDF' }}</span>
          </button>
          <button
            type="button"
            class="btn-export-options"
            (click)="showExportMenu = !showExportMenu"
            title="Export Options"
          >
            <app-icon name="chevron-down" [size]="12"></app-icon>
          </button>

          <!-- Dropdown Menu -->
          <div
            *ngIf="showExportMenu"
            class="export-menu"
            (click)="$event.stopPropagation()"
          >
            <button
              type="button"
              class="export-menu-item"
              (click)="triggerExport('all')"
            >
              Export All Pages ({{ state.activePages().length }})
            </button>
            <button
              type="button"
              class="export-menu-item"
              (click)="triggerExport('current')"
            >
              Export Current Page Only (Page {{ state.activePageIndex() + 1 }})
            </button>
          </div>
        </div>

        <!-- Close / Reset Document -->
        <button
          type="button"
          class="btn-reset"
          (click)="requestReset.emit()"
          title="Close Document & Return Home"
        >
          <app-icon name="close" [size]="16"></app-icon>
        </button>
      </div>
    </header>
  `,
  styles: [`
    .toolbar {
      height: 56px;
      background: #0f172a;
      border-bottom: 1px solid #1e293b;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1rem;
      gap: 0.75rem;
      flex-shrink: 0;
      color: #f8fafc;
      z-index: 20;
    }
    .toolbar-left, .toolbar-center, .toolbar-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 700;
      font-size: 0.9375rem;
      color: #f8fafc;
    }
    .brand-icon {
      width: 28px;
      height: 28px;
      border-radius: 0.375rem;
      background: #4f46e5;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
    }
    .doc-info {
      display: flex;
      flex-direction: column;
      max-width: 180px;
    }
    .doc-name {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #e2e8f0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .doc-meta {
      font-size: 0.7rem;
      color: #64748b;
    }
    .divider {
      width: 1px;
      height: 24px;
      background: #334155;
      margin: 0 0.25rem;
    }
    .btn-group {
      display: flex;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 0.5rem;
      padding: 2px;
      gap: 2px;
    }
    .tool-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      padding: 0.35rem 0.55rem;
      border-radius: 0.375rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.78125rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .tool-btn:hover:not(:disabled) {
      color: #ffffff;
      background: #334155;
    }
    .tool-btn.active {
      background: #4f46e5;
      color: #ffffff;
    }
    .tool-btn.edit-text-btn.active {
      background: #0284c7;
      color: #ffffff;
    }
    .tool-btn.cover-btn.active {
      background: #b45309;
      color: #ffffff;
    }
    .tool-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    .tool-label {
      font-size: 0.78125rem;
    }
    .zoom-select {
      background: transparent;
      border: none;
      color: #cbd5e1;
      font-size: 0.75rem;
      padding: 0.2rem 0.3rem;
      outline: none;
      cursor: pointer;
    }
    .page-stepper {
      display: flex;
      align-items: center;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 0.375rem;
      overflow: hidden;
    }
    .btn-step {
      background: transparent;
      border: none;
      color: #94a3b8;
      padding: 0.35rem 0.5rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn-step:hover:not(:disabled) {
      background: #334155;
      color: #ffffff;
    }
    .btn-step:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    .page-indicator {
      font-size: 0.75rem;
      font-weight: 500;
      color: #e2e8f0;
      padding: 0 0.4rem;
      min-width: 54px;
      text-align: center;
    }
    .export-dropdown-wrap {
      position: relative;
      display: flex;
    }
    .btn {
      padding: 0.45rem 0.85rem;
      border-radius: 0.375rem;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      border: none;
      transition: all 0.15s ease;
    }
    .btn-export {
      background: #4f46e5;
      color: #ffffff;
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }
    .btn-export:hover:not(:disabled) {
      background: #4338ca;
    }
    .btn-export-options {
      background: #4338ca;
      border: none;
      border-left: 1px solid rgba(255, 255, 255, 0.2);
      color: #ffffff;
      padding: 0 0.4rem;
      border-top-right-radius: 0.375rem;
      border-bottom-right-radius: 0.375rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn-export-options:hover {
      background: #3730a3;
    }
    .export-menu {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 0.35rem;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 0.5rem;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
      min-width: 220px;
      overflow: hidden;
      z-index: 100;
    }
    .export-menu-item {
      width: 100%;
      text-align: left;
      padding: 0.6rem 0.85rem;
      background: transparent;
      border: none;
      color: #e2e8f0;
      font-size: 0.8125rem;
      cursor: pointer;
      display: block;
    }
    .export-menu-item:hover {
      background: #334155;
      color: #ffffff;
    }
    .btn-reset {
      background: transparent;
      border: 1px solid #334155;
      color: #94a3b8;
      width: 32px;
      height: 32px;
      border-radius: 0.375rem;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .btn-reset:hover {
      background: #334155;
      color: #ffffff;
    }
    @media (max-width: 900px) {
      .tool-label {
        display: none;
      }
      .brand-name {
        display: none;
      }
    }
  `]
})
export class TopToolbarComponent {
  state = inject(EditorStateService);

  @Input() isExporting = false;
  @Output() openSignatureModal = new EventEmitter<void>();
  @Output() insertImageFile = new EventEmitter<File>();
  @Output() exportPdf = new EventEmitter<ExportOptions>();
  @Output() fitPage = new EventEmitter<void>();
  @Output() fitWidth = new EventEmitter<void>();
  @Output() requestReset = new EventEmitter<void>();

  showExportMenu = false;

  get currentZoomPercent(): string {
    return Math.round(this.state.zoom() * 100).toString();
  }

  setTool(tool: EditorTool): void {
    this.state.activeTool.set(tool);
    if (tool !== 'select') {
      this.state.selectedAnnotationId.set(null);
    }
  }

  onZoomPercentChange(val: string): void {
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      this.state.setZoom(num / 100);
    }
  }

  onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.insertImageFile.emit(input.files[0]);
      input.value = ''; // Reset input
    }
  }

  triggerExport(scope: 'all' | 'current'): void {
    this.showExportMenu = false;
    const docName = this.state.documentInfo()?.name || 'document';
    const baseName = docName.replace(/\.pdf$/i, '');
    this.exportPdf.emit({
      scope,
      fileName: `${baseName}-edited.pdf`
    });
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
