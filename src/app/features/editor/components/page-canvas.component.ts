import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EditorStateService } from '../../../core/services/editor-state.service';
import { CoordinateService } from '../../../core/services/coordinate.service';
import { PdfLoaderService } from '../../../core/services/pdf-loader.service';
import {
  Annotation,
  CoverAnnotation,
  ImageAnnotation,
  PageMeta,
  TextAnnotation,
  TransformHandle
} from '../../../core/models/pdf-editor.models';

interface DragState {
  type: 'move' | 'resize' | 'rotate';
  handle?: TransformHandle;
  annId: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
  origRot: number;
  centerX: number;
  centerY: number;
  aspectRatio: number;
}

@Component({
  selector: 'app-page-canvas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      #viewport
      class="canvas-viewport"
      (pointerdown)="onViewportPointerDown($event)"
      (pointermove)="onPointerMove($event)"
      (pointerup)="onPointerUp()"
      (pointerleave)="onPointerUp()"
    >
      <div
        class="page-wrapper"
        [style.width.px]="pageCssWidth"
        [style.height.px]="pageCssHeight"
      >
        <!-- Canvas for PDF.js page rendering -->
        <canvas #pdfCanvas class="pdf-page-canvas"></canvas>

        <!-- Loading spinner while page renders -->
        <div *ngIf="isRendering" class="canvas-loading-overlay">
          <div class="spinner"></div>
          <span class="loading-label">Rendering page {{ pageMeta?.pageNumber }}...</span>
        </div>

        <!-- Interactive Annotation Overlay Layer -->
        <div
          class="annotation-layer"
          [style.width.px]="pageCssWidth"
          [style.height.px]="pageCssHeight"
        >
          <!-- Annotation Items -->
          <div
            *ngFor="let ann of activeAnnotations()"
            class="annotation-box"
            [class.selected]="state.selectedAnnotationId() === ann.id"
            [class.is-editing]="editingTextId === ann.id"
            [style.left.px]="ann.x * state.zoom()"
            [style.top.px]="ann.y * state.zoom()"
            [style.width.px]="ann.width * state.zoom()"
            [style.height.px]="ann.height * state.zoom()"
            [style.transform]="'rotate(' + (ann.rotation || 0) + 'deg)'"
            [style.z-index]="ann.zIndex"
            [style.opacity]="ann.opacity"
            (pointerdown)="onAnnotationPointerDown($event, ann)"
          >
            <!-- 1. Text Annotation -->
            <ng-container *ngIf="ann.type === 'text'">
              <div
                *ngIf="editingTextId !== ann.id"
                class="text-content"
                [style.font-family]="getFontFamilyCss(asText(ann).fontFamily)"
                [style.font-size.px]="asText(ann).fontSize * state.zoom()"
                [style.color]="asText(ann).color"
                [style.font-weight]="asText(ann).isBold ? 'bold' : 'normal'"
                [style.font-style]="asText(ann).isItalic ? 'italic' : 'normal'"
                [style.text-align]="asText(ann).align"
                (dblclick)="startEditText(ann.id)"
              >
                {{ asText(ann).text || 'Double click to edit' }}
              </div>

              <!-- Inline Textarea Editor -->
              <textarea
                *ngIf="editingTextId === ann.id"
                #inlineTextArea
                class="inline-text-editor"
                [style.font-family]="getFontFamilyCss(asText(ann).fontFamily)"
                [style.font-size.px]="asText(ann).fontSize * state.zoom()"
                [style.color]="asText(ann).color"
                [style.font-weight]="asText(ann).isBold ? 'bold' : 'normal'"
                [style.font-style]="asText(ann).isItalic ? 'italic' : 'normal'"
                [style.text-align]="asText(ann).align"
                [ngModel]="asText(ann).text"
                (ngModelChange)="onTextChange(ann.id, $event)"
                (blur)="finishEditText()"
                (keydown.escape)="finishEditText()"
                (pointerdown)="$event.stopPropagation()"
              ></textarea>
            </ng-container>

            <!-- 2. Image / Signature Annotation -->
            <ng-container *ngIf="ann.type === 'image'">
              <img
                [src]="asImage(ann).dataUrl"
                alt="Inserted element"
                class="image-content"
                draggable="false"
              />
            </ng-container>

            <!-- 3. Cover-Up Annotation -->
            <ng-container *ngIf="ann.type === 'cover'">
              <div
                class="cover-content"
                [style.background-color]="asCover(ann).fillColor"
                [style.border-color]="asCover(ann).borderColor || 'transparent'"
                [style.border-width.px]="asCover(ann).borderWidth || 0"
              >
                <span class="cover-tag">Visual Cover</span>
              </div>
            </ng-container>

            <!-- SELECTION TRANSFORM HANDLES (When Selected & Not Inline Editing) -->
            <div
              *ngIf="state.selectedAnnotationId() === ann.id && editingTextId !== ann.id"
              class="selection-frame"
            >
              <!-- Rotation handle & stem -->
              <div class="rot-stem"></div>
              <div
                class="handle handle-rot"
                (pointerdown)="startHandleDrag($event, ann, 'rot')"
                title="Rotate element"
              ></div>

              <!-- 8 Resize handles -->
              <div
                class="handle handle-tl"
                (pointerdown)="startHandleDrag($event, ann, 'tl')"
              ></div>
              <div
                class="handle handle-tc"
                (pointerdown)="startHandleDrag($event, ann, 'tc')"
              ></div>
              <div
                class="handle handle-tr"
                (pointerdown)="startHandleDrag($event, ann, 'tr')"
              ></div>
              <div
                class="handle handle-ml"
                (pointerdown)="startHandleDrag($event, ann, 'ml')"
              ></div>
              <div
                class="handle handle-mr"
                (pointerdown)="startHandleDrag($event, ann, 'mr')"
              ></div>
              <div
                class="handle handle-bl"
                (pointerdown)="startHandleDrag($event, ann, 'bl')"
              ></div>
              <div
                class="handle handle-bc"
                (pointerdown)="startHandleDrag($event, ann, 'bc')"
              ></div>
              <div
                class="handle handle-br"
                (pointerdown)="startHandleDrag($event, ann, 'br')"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .canvas-viewport {
      flex: 1;
      width: 100%;
      height: 100%;
      background: #090d16;
      overflow: auto;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 2.5rem 1rem;
      position: relative;
      user-select: none;
    }
    .page-wrapper {
      position: relative;
      background: #ffffff;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
      border-radius: 2px;
      margin: auto;
      flex-shrink: 0;
    }
    .pdf-page-canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
    .canvas-loading-overlay {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(2px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      color: #f8fafc;
      z-index: 100;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid rgba(99, 102, 241, 0.3);
      border-top-color: #818cf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .loading-label {
      font-size: 0.8125rem;
      font-weight: 500;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .annotation-layer {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: auto;
    }
    .annotation-box {
      position: absolute;
      cursor: move;
      box-sizing: border-box;
      touch-action: none;
    }
    .annotation-box.selected {
      outline: 1.5px solid #6366f1;
    }
    .text-content {
      width: 100%;
      height: 100%;
      word-break: break-word;
      white-space: pre-wrap;
      line-height: 1.25;
      padding: 2px;
      box-sizing: border-box;
      user-select: none;
    }
    .inline-text-editor {
      width: 100%;
      height: 100%;
      border: 1px dashed #6366f1;
      background: rgba(255, 255, 255, 0.95);
      outline: none;
      resize: none;
      line-height: 1.25;
      padding: 2px;
      box-sizing: border-box;
    }
    .image-content {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      pointer-events: none;
    }
    .cover-content {
      width: 100%;
      height: 100%;
      border-style: solid;
      box-sizing: border-box;
      position: relative;
    }
    .cover-tag {
      position: absolute;
      top: 2px;
      left: 2px;
      background: rgba(245, 158, 11, 0.85);
      color: #000000;
      font-size: 0.6rem;
      font-weight: 700;
      padding: 0 0.25rem;
      border-radius: 2px;
      opacity: 0;
      transition: opacity 0.15s ease;
      pointer-events: none;
    }
    .annotation-box:hover .cover-tag,
    .annotation-box.selected .cover-tag {
      opacity: 1;
    }
    .selection-frame {
      position: absolute;
      inset: -1px;
      border: 1.5px solid #6366f1;
      pointer-events: none;
    }
    .rot-stem {
      position: absolute;
      top: -18px;
      left: 50%;
      width: 1px;
      height: 18px;
      background: #6366f1;
      transform: translateX(-50%);
    }
    .handle {
      position: absolute;
      width: 9px;
      height: 9px;
      background: #ffffff;
      border: 1.5px solid #4f46e5;
      border-radius: 2px;
      pointer-events: auto;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }
    .handle-rot {
      top: -24px;
      left: 50%;
      transform: translateX(-50%);
      border-radius: 50%;
      background: #6366f1;
      border-color: #ffffff;
      cursor: grab;
      width: 10px;
      height: 10px;
    }
    .handle-rot:active {
      cursor: grabbing;
    }
    .handle-tl { top: -5px; left: -5px; cursor: nwse-resize; }
    .handle-tc { top: -5px; left: calc(50% - 4.5px); cursor: ns-resize; }
    .handle-tr { top: -5px; right: -5px; cursor: nesw-resize; }
    .handle-ml { top: calc(50% - 4.5px); left: -5px; cursor: ew-resize; }
    .handle-mr { top: calc(50% - 4.5px); right: -5px; cursor: ew-resize; }
    .handle-bl { bottom: -5px; left: -5px; cursor: nesw-resize; }
    .handle-bc { bottom: -5px; left: calc(50% - 4.5px); cursor: ns-resize; }
    .handle-br { bottom: -5px; right: -5px; cursor: nwse-resize; }
  `]
})
export class PageCanvasComponent implements OnChanges, OnDestroy {
  state = inject(EditorStateService);
  coordinateService = inject(CoordinateService);
  pdfLoader = inject(PdfLoaderService);

  @Input() pdfDoc: any = null;
  @Input() pageMeta: PageMeta | null = null;
  @Output() fitCalculated = new EventEmitter<number>();

  @ViewChild('pdfCanvas') pdfCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('viewport') viewportRef?: ElementRef<HTMLDivElement>;

  pageCssWidth = 612;
  pageCssHeight = 792;
  isRendering = false;
  editingTextId: string | null = null;

  private currentRenderTask: any = null;
  private dragState: DragState | null = null;

  get activeAnnotations() {
    return this.state.activePageAnnotations;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pageMeta'] || changes['pdfDoc']) {
      this.renderCurrentPage();
    }
  }

  ngOnDestroy(): void {
    if (this.currentRenderTask) {
      try {
        this.currentRenderTask.cancel();
      } catch (e) {
        // ignore cancellation
      }
    }
  }

  async renderCurrentPage(): Promise<void> {
    if (!this.pdfDoc || !this.pageMeta || !this.pdfCanvasRef) return;

    this.isRendering = true;
    try {
      const pageIndex = this.pageMeta.originalPageIndex + 1;
      const page = await this.pdfDoc.getPage(pageIndex);
      const canvas = this.pdfCanvasRef.nativeElement;

      const visualDim = this.coordinateService.getVisualDimensions(
        this.pageMeta.width,
        this.pageMeta.height,
        this.pageMeta.rotation
      );

      this.pageCssWidth = Math.floor(visualDim.width * this.state.zoom());
      this.pageCssHeight = Math.floor(visualDim.height * this.state.zoom());

      const res = await this.pdfLoader.renderPageToCanvas(
        page,
        canvas,
        this.state.zoom(),
        this.pageMeta.rotation
      );

      this.pageCssWidth = res.cssWidth;
      this.pageCssHeight = res.cssHeight;
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Failed to render PDF page:', err);
      }
    } finally {
      this.isRendering = false;
    }
  }

  asText(ann: Annotation): TextAnnotation {
    return ann as TextAnnotation;
  }

  asImage(ann: Annotation): ImageAnnotation {
    return ann as ImageAnnotation;
  }

  asCover(ann: Annotation): CoverAnnotation {
    return ann as CoverAnnotation;
  }

  getFontFamilyCss(family: string): string {
    if (family === 'TimesRoman') return '"Times New Roman", Times, serif';
    if (family === 'Courier') return '"Courier New", Courier, monospace';
    return 'Helvetica, Arial, sans-serif';
  }

  startEditText(id: string): void {
    this.editingTextId = id;
  }

  finishEditText(): void {
    this.editingTextId = null;
  }

  onTextChange(id: string, text: string): void {
    this.state.updateAnnotation(id, { text });
  }

  // Pointer & Click handling on Viewport / Background
  onViewportPointerDown(event: PointerEvent): void {
    if (event.target !== event.currentTarget) return;

    const tool = this.state.activeTool();
    if (tool === 'select') {
      this.state.selectAnnotation(null);
      this.finishEditText();
      return;
    }

    // Creating new elements on click
    if (!this.pageMeta) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const ptX = Math.round(this.coordinateService.screenToPdfPoints(clickX, this.state.zoom()));
    const ptY = Math.round(this.coordinateService.screenToPdfPoints(clickY, this.state.zoom()));

    if (tool === 'text') {
      const newText: TextAnnotation = {
        id: `text-${Date.now()}`,
        type: 'text',
        pageIndex: this.pageMeta.pageIndex,
        x: ptX,
        y: ptY,
        width: 180,
        height: 36,
        rotation: 0,
        opacity: 1,
        zIndex: Date.now() % 1000,
        text: 'Enter text here',
        fontSize: 16,
        fontFamily: 'Helvetica',
        color: '#111827',
        isBold: false,
        isItalic: false,
        align: 'left'
      };
      this.state.addAnnotation(newText);
      this.startEditText(newText.id);
    } else if (tool === 'cover') {
      const newCover: CoverAnnotation = {
        id: `cover-${Date.now()}`,
        type: 'cover',
        pageIndex: this.pageMeta.pageIndex,
        x: ptX,
        y: ptY,
        width: 140,
        height: 36,
        rotation: 0,
        opacity: 1,
        zIndex: Date.now() % 1000,
        fillColor: '#ffffff',
        borderColor: '#e2e8f0',
        borderWidth: 1
      };
      this.state.addAnnotation(newCover);
    }
  }

  onAnnotationPointerDown(event: PointerEvent, ann: Annotation): void {
    event.stopPropagation();
    this.state.selectAnnotation(ann.id);

    if (this.editingTextId === ann.id) return;

    const zoom = this.state.zoom();
    const centerX = (ann.x + ann.width / 2) * zoom;
    const centerY = (ann.y + ann.height / 2) * zoom;

    this.dragState = {
      type: 'move',
      annId: ann.id,
      startX: event.clientX,
      startY: event.clientY,
      origX: ann.x,
      origY: ann.y,
      origW: ann.width,
      origH: ann.height,
      origRot: ann.rotation || 0,
      centerX,
      centerY,
      aspectRatio: ann.width / ann.height
    };
  }

  startHandleDrag(event: PointerEvent, ann: Annotation, handle: TransformHandle): void {
    event.stopPropagation();
    const zoom = this.state.zoom();
    const centerX = (ann.x + ann.width / 2) * zoom;
    const centerY = (ann.y + ann.height / 2) * zoom;

    this.dragState = {
      type: handle === 'rot' ? 'rotate' : 'resize',
      handle,
      annId: ann.id,
      startX: event.clientX,
      startY: event.clientY,
      origX: ann.x,
      origY: ann.y,
      origW: ann.width,
      origH: ann.height,
      origRot: ann.rotation || 0,
      centerX,
      centerY,
      aspectRatio: ann.width / ann.height
    };
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragState) return;

    const zoom = this.state.zoom();
    const { type, handle, annId, startX, startY, origX, origY, origW, origH, origRot, centerX, centerY } =
      this.dragState;

    const deltaX = (event.clientX - startX) / zoom;
    const deltaY = (event.clientY - startY) / zoom;

    if (type === 'move') {
      const nextX = Math.round(origX + deltaX);
      const nextY = Math.round(origY + deltaY);
      this.state.updateAnnotation(annId, { x: nextX, y: nextY }, false);
    } else if (type === 'resize' && handle) {
      let newX = origX;
      let newY = origY;
      let newW = origW;
      let newH = origH;

      // Handle directions
      if (handle.includes('r')) {
        newW = Math.max(20, origW + deltaX);
      }
      if (handle.includes('l')) {
        const potentialW = origW - deltaX;
        if (potentialW >= 20) {
          newW = potentialW;
          newX = origX + deltaX;
        }
      }
      if (handle.includes('b')) {
        newH = Math.max(15, origH + deltaY);
      }
      if (handle.includes('t')) {
        const potentialH = origH - deltaY;
        if (potentialH >= 15) {
          newH = potentialH;
          newY = origY + deltaY;
        }
      }

      this.state.updateAnnotation(
        annId,
        {
          x: Math.round(newX),
          y: Math.round(newY),
          width: Math.round(newW),
          height: Math.round(newH)
        },
        false
      );
    } else if (type === 'rotate') {
      // Calculate rotation angle relative to center of element
      const currentMouseX = event.clientX;
      const currentMouseY = event.clientY;

      const angleRad = Math.atan2(currentMouseY - centerY, currentMouseX - centerX);
      // Angle in degrees from top (stem is at -90 deg)
      let deg = Math.round((angleRad * 180) / Math.PI + 90);
      deg = ((deg % 360) + 360) % 360;

      // Snap to 45 deg or 90 deg increments if close
      if (Math.abs(deg % 45) < 3 || Math.abs(deg % 45) > 42) {
        deg = Math.round(deg / 45) * 45;
      }

      this.state.updateAnnotation(annId, { rotation: deg }, false);
    }
  }

  onPointerUp(): void {
    if (this.dragState) {
      const ann = this.state.annotations().find((a) => a.id === this.dragState?.annId);
      if (ann) {
        // Record undo history for finished movement/transform
        this.state.pushAction({
          id: `transform-${ann.id}-${Date.now()}`,
          description: `Transform ${ann.type}`,
          undo: () =>
            this.state.updateAnnotation(
              ann.id,
              {
                x: this.dragState!.origX,
                y: this.dragState!.origY,
                width: this.dragState!.origW,
                height: this.dragState!.origH,
                rotation: this.dragState!.origRot
              },
              false
            ),
          redo: () =>
            this.state.updateAnnotation(
              ann.id,
              {
                x: ann.x,
                y: ann.y,
                width: ann.width,
                height: ann.height,
                rotation: ann.rotation
              },
              false
            )
        });
      }
      this.dragState = null;
    }
  }
}
