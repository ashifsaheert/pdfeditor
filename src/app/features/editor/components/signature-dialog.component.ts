import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-signature-dialog',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div
      *ngIf="isOpen"
      class="dialog-backdrop"
      (click)="onBackdropClick($event)"
      role="dialog"
      aria-modal="true"
    >
      <div class="dialog-card" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="dialog-header">
          <div class="header-left">
            <div class="dialog-icon">
              <app-icon name="signature" [size]="20"></app-icon>
            </div>
            <div>
              <h3 class="dialog-title">Insert Signature</h3>
              <p class="dialog-subtitle">Draw your signature or upload a transparent PNG image</p>
            </div>
          </div>
          <button type="button" class="btn-icon-close" (click)="close.emit()" aria-label="Close">
            <app-icon name="close" [size]="18"></app-icon>
          </button>
        </div>

        <!-- Mode Tabs -->
        <div class="dialog-tabs">
          <button
            type="button"
            class="tab-btn"
            [class.active]="activeTab === 'draw'"
            (click)="activeTab = 'draw'"
          >
            Draw Signature
          </button>
          <button
            type="button"
            class="tab-btn"
            [class.active]="activeTab === 'upload'"
            (click)="activeTab = 'upload'"
          >
            Upload Image
          </button>
        </div>

        <!-- Tab 1: Draw Signature Pad -->
        <div *ngIf="activeTab === 'draw'" class="tab-content">
          <div class="canvas-container">
            <canvas
              #sigCanvas
              class="sig-canvas"
              width="500"
              height="200"
              (pointerdown)="startDrawing($event)"
              (pointermove)="draw($event)"
              (pointerup)="stopDrawing()"
              (pointerleave)="stopDrawing()"
            ></canvas>
            <div *ngIf="!hasDrawn" class="canvas-placeholder">
              Sign above using mouse, stylus, or touch
            </div>
          </div>

          <!-- Controls: Color & Clear -->
          <div class="draw-controls">
            <div class="color-options">
              <span class="label">Color:</span>
              <button
                type="button"
                *ngFor="let col of penColors"
                class="color-dot"
                [style.background-color]="col"
                [class.selected]="selectedColor === col"
                (click)="selectedColor = col"
                [attr.aria-label]="col"
              ></button>
            </div>

            <div class="stroke-options">
              <span class="label">Width:</span>
              <button
                type="button"
                class="btn-width"
                [class.active]="strokeWidth === 2"
                (click)="strokeWidth = 2"
              >
                Thin
              </button>
              <button
                type="button"
                class="btn-width"
                [class.active]="strokeWidth === 3.5"
                (click)="strokeWidth = 3.5"
              >
                Medium
              </button>
              <button
                type="button"
                class="btn-width"
                [class.active]="strokeWidth === 5"
                (click)="strokeWidth = 5"
              >
                Thick
              </button>
            </div>

            <button type="button" class="btn-clear" (click)="clearCanvas()">
              <app-icon name="trash" [size]="14"></app-icon> Clear
            </button>
          </div>
        </div>

        <!-- Tab 2: Upload File -->
        <div *ngIf="activeTab === 'upload'" class="tab-content">
          <div
            class="upload-dropzone"
            [class.drag-over]="isDragging"
            (dragover)="onDragOver($event)"
            (dragleave)="isDragging = false"
            (drop)="onFileDrop($event)"
            (click)="fileInput.click()"
          >
            <input
              #fileInput
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              class="hidden-input"
              (change)="onFileInputChange($event)"
            />
            <div *ngIf="!uploadedDataUrl" class="upload-prompt">
              <div class="upload-icon">
                <app-icon name="upload" [size]="28"></app-icon>
              </div>
              <p class="upload-main">Click or drag a signature image here</p>
              <p class="upload-sub">Recommended: Transparent PNG for cleanest placement</p>
            </div>

            <div *ngIf="uploadedDataUrl" class="upload-preview-wrap">
              <img [src]="uploadedDataUrl" alt="Uploaded signature preview" class="upload-preview" />
              <button
                type="button"
                class="btn-remove-preview"
                (click)="$event.stopPropagation(); uploadedDataUrl = null"
              >
                Remove
              </button>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="dialog-actions">
          <button type="button" class="btn btn-secondary" (click)="close.emit()">
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            [disabled]="activeTab === 'draw' ? !hasDrawn : !uploadedDataUrl"
            (click)="save()"
          >
            Insert Signature
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 1rem;
    }
    .dialog-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 1rem;
      width: 100%;
      max-width: 540px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      padding: 1.5rem;
      color: #f8fafc;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .dialog-icon {
      width: 40px;
      height: 40px;
      border-radius: 0.625rem;
      background: rgba(99, 102, 241, 0.15);
      color: #818cf8;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .dialog-title {
      font-size: 1.125rem;
      font-weight: 600;
      margin: 0;
    }
    .dialog-subtitle {
      font-size: 0.8125rem;
      color: #94a3b8;
      margin: 0.15rem 0 0 0;
    }
    .btn-icon-close {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 0.375rem;
    }
    .btn-icon-close:hover {
      color: #ffffff;
      background: #334155;
    }
    .dialog-tabs {
      display: flex;
      gap: 0.5rem;
      border-bottom: 1px solid #334155;
      margin-bottom: 1.25rem;
    }
    .tab-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
    }
    .tab-btn.active {
      color: #818cf8;
      border-bottom-color: #6366f1;
    }
    .canvas-container {
      position: relative;
      background: #ffffff;
      border: 1px solid #475569;
      border-radius: 0.625rem;
      overflow: hidden;
      display: flex;
      justify-content: center;
    }
    .sig-canvas {
      touch-action: none;
      cursor: crosshair;
      display: block;
    }
    .canvas-placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      font-size: 0.875rem;
      pointer-events: none;
      user-select: none;
    }
    .draw-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 1rem;
      font-size: 0.8125rem;
      color: #94a3b8;
    }
    .color-options, .stroke-options {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .color-dot {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
    }
    .color-dot.selected {
      border-color: #ffffff;
      outline: 2px solid #6366f1;
    }
    .btn-width {
      background: #334155;
      border: none;
      color: #cbd5e1;
      padding: 0.25rem 0.5rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      cursor: pointer;
    }
    .btn-width.active {
      background: #4f46e5;
      color: #ffffff;
    }
    .btn-clear {
      background: transparent;
      border: 1px solid #475569;
      color: #cbd5e1;
      padding: 0.3rem 0.6rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .btn-clear:hover {
      background: #334155;
      color: #f87171;
    }
    .upload-dropzone {
      border: 2px dashed #475569;
      border-radius: 0.75rem;
      padding: 2.5rem 1.5rem;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      background: rgba(30, 41, 59, 0.5);
    }
    .upload-dropzone:hover, .upload-dropzone.drag-over {
      border-color: #6366f1;
      background: rgba(99, 102, 241, 0.05);
    }
    .hidden-input {
      display: none;
    }
    .upload-icon {
      color: #818cf8;
      margin-bottom: 0.75rem;
    }
    .upload-main {
      font-size: 0.9375rem;
      font-weight: 500;
      color: #e2e8f0;
      margin: 0;
    }
    .upload-sub {
      font-size: 0.8125rem;
      color: #94a3b8;
      margin: 0.35rem 0 0 0;
    }
    .upload-preview-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }
    .upload-preview {
      max-height: 120px;
      max-width: 100%;
      object-fit: contain;
      background: #ffffff;
      padding: 0.5rem;
      border-radius: 0.5rem;
    }
    .btn-remove-preview {
      background: #334155;
      border: none;
      color: #f87171;
      padding: 0.3rem 0.75rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      cursor: pointer;
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.5rem;
    }
    .btn {
      padding: 0.55rem 1.25rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      border: none;
    }
    .btn-secondary {
      background: #334155;
      color: #cbd5e1;
    }
    .btn-secondary:hover {
      background: #475569;
      color: #ffffff;
    }
    .btn-primary {
      background: #4f46e5;
      color: #ffffff;
    }
    .btn-primary:hover:not(:disabled) {
      background: #4338ca;
    }
    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `]
})
export class SignatureDialogComponent implements AfterViewInit {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() insertSignature = new EventEmitter<{ dataUrl: string; aspectRatio: number }>();

  @ViewChild('sigCanvas') sigCanvasRef?: ElementRef<HTMLCanvasElement>;

  activeTab: 'draw' | 'upload' = 'draw';
  penColors = ['#000000', '#1d4ed8', '#047857'];
  selectedColor = '#000000';
  strokeWidth = 3.5;
  hasDrawn = false;
  isDragging = false;
  uploadedDataUrl: string | null = null;
  uploadedAspectRatio = 2.5;

  private isDrawing = false;
  private ctx: CanvasRenderingContext2D | null = null;
  private lastX = 0;
  private lastY = 0;

  ngAfterViewInit(): void {
    this.initCanvas();
  }

  private initCanvas(): void {
    if (!this.sigCanvasRef) return;
    const canvas = this.sigCanvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
    if (this.ctx) {
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
    }
  }

  startDrawing(event: PointerEvent): void {
    if (!this.ctx || !this.sigCanvasRef) {
      this.initCanvas();
      if (!this.ctx || !this.sigCanvasRef) return;
    }

    const rect = this.sigCanvasRef.nativeElement.getBoundingClientRect();
    this.lastX = event.clientX - rect.left;
    this.lastY = event.clientY - rect.top;
    this.isDrawing = true;
    this.hasDrawn = true;

    // Draw single dot on click
    this.ctx.strokeStyle = this.selectedColor;
    this.ctx.lineWidth = this.strokeWidth;
    this.ctx.beginPath();
    this.ctx.arc(this.lastX, this.lastY, this.strokeWidth / 2, 0, Math.PI * 2);
    this.ctx.fillStyle = this.selectedColor;
    this.ctx.fill();
  }

  draw(event: PointerEvent): void {
    if (!this.isDrawing || !this.ctx || !this.sigCanvasRef) return;

    const rect = this.sigCanvasRef.nativeElement.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    this.ctx.strokeStyle = this.selectedColor;
    this.ctx.lineWidth = this.strokeWidth;
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(currentX, currentY);
    this.ctx.stroke();

    this.lastX = currentX;
    this.lastY = currentY;
  }

  stopDrawing(): void {
    this.isDrawing = false;
  }

  clearCanvas(): void {
    if (!this.ctx || !this.sigCanvasRef) return;
    const canvas = this.sigCanvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.hasDrawn = false;
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleImageFile(files[0]);
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleImageFile(input.files[0]);
    }
  }

  private handleImageFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        this.uploadedAspectRatio = img.naturalWidth / img.naturalHeight;
        this.uploadedDataUrl = dataUrl;
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  save(): void {
    if (this.activeTab === 'draw') {
      if (!this.sigCanvasRef || !this.hasDrawn) return;
      const trimmed = this.trimCanvas(this.sigCanvasRef.nativeElement);
      this.insertSignature.emit(trimmed);
    } else {
      if (!this.uploadedDataUrl) return;
      this.insertSignature.emit({
        dataUrl: this.uploadedDataUrl,
        aspectRatio: this.uploadedAspectRatio
      });
    }
    this.close.emit();
  }

  /**
   * Trims transparent borders around drawn signature so placed image has clean bounds.
   */
  private trimCanvas(canvas: HTMLCanvasElement): { dataUrl: string; aspectRatio: number } {
    const ctx = canvas.getContext('2d');
    if (!ctx) return { dataUrl: canvas.toDataURL('image/png'), aspectRatio: canvas.width / canvas.height };

    const { width, height } = canvas;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (minX > maxX || minY > maxY) {
      return { dataUrl: canvas.toDataURL('image/png'), aspectRatio: width / height };
    }

    const pad = 10;
    const cropX = Math.max(0, minX - pad);
    const cropY = Math.max(0, minY - pad);
    const cropW = Math.min(width - cropX, maxX - minX + pad * 2);
    const cropH = Math.min(height - cropY, maxY - minY + pad * 2);

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) {
      return { dataUrl: canvas.toDataURL('image/png'), aspectRatio: width / height };
    }

    cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    const dataUrl = cropCanvas.toDataURL('image/png');
    return { dataUrl, aspectRatio: cropW / cropH };
  }
}
