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
  ExtractedTextItem,
  ImageAnnotation,
  PageMeta,
  StandardFontFamily,
  TextAnnotation,
  TextReplacementAnnotation,
  TransformHandle
} from '../../../core/models/pdf-editor.models';
import { IconComponent } from '../../../shared/components/icon.component';

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
  imports: [CommonModule, FormsModule, IconComponent],
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

        <!-- Interactive PDF Text Selection Layer (active in edit-text mode) -->
        <div
          *ngIf="state.activeTool() === 'edit-text'"
          class="extracted-text-layer"
          [style.width.px]="pageCssWidth"
          [style.height.px]="pageCssHeight"
        >
          <div
            *ngFor="let item of pageTextItems"
            class="text-item-target"
            [class.hovered]="hoveredTextId === item.id"
            [style.left.px]="item.x * state.zoom()"
            [style.top.px]="item.y * state.zoom()"
            [style.width.px]="item.width * state.zoom()"
            [style.height.px]="item.height * state.zoom()"
            (pointerenter)="hoveredTextId = item.id"
            (pointerleave)="hoveredTextId = null"
            (click)="onTextItemClick($event, item)"
            [title]="'Click to edit: &quot;' + item.str + '&quot;'"
          >
            <span class="text-target-hint">Edit</span>
          </div>
        </div>

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

            <!-- 4. Text Replacement Annotation -->
            <ng-container *ngIf="ann.type === 'text-replace'">
              <!-- Visual cover background matching page surface -->
              <div
                class="replace-cover-bg"
                [style.background-color]="asReplace(ann).backgroundColor"
              ></div>

              <!-- Replacement text overlay -->
              <div
                class="text-content text-replace-content"
                [style.font-family]="getFontFamilyCss(asReplace(ann).fontFamily)"
                [style.font-size.px]="asReplace(ann).fontSize * state.zoom()"
                [style.color]="asReplace(ann).color"
                [style.font-weight]="asReplace(ann).isBold ? 'bold' : 'normal'"
                [style.font-style]="asReplace(ann).isItalic ? 'italic' : 'normal'"
                [style.text-align]="asReplace(ann).align"
                (dblclick)="openEditModalForAnnotation(asReplace(ann))"
                title="Double click to edit replacement text"
              >
                {{ asReplace(ann).text }}
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

      <!-- INLINE TEXT REPLACEMENT DIALOG MODAL -->
      <div
        *ngIf="isReplacementDialogOpen"
        class="replacement-modal-overlay"
        (click)="closeReplacementDialog()"
      >
        <div
          class="replacement-dialog"
          (click)="$event.stopPropagation()"
          (keydown.escape)="closeReplacementDialog()"
        >
          <div class="dialog-header">
            <div class="dialog-title-wrap">
              <app-icon name="edit-text" [size]="16"></app-icon>
              <span class="dialog-title">Edit Existing PDF Text</span>
            </div>
            <button
              type="button"
              class="dialog-close-btn"
              (click)="closeReplacementDialog()"
              title="Cancel (Esc)"
            >
              <app-icon name="close" [size]="14"></app-icon>
            </button>
          </div>

          <!-- Disclosure warning alert box -->
          <div class="dialog-disclosure-alert">
            <app-icon name="shield" [size]="14" customClass="alert-icon"></app-icon>
            <span>
              <strong>Visual Replacement:</strong> Covers original text with an opaque background and overlays the new text. Original text remains in the PDF stream and is not cryptographically sanitized.
            </span>
          </div>

          <!-- Replacement Textarea -->
          <div class="form-group">
            <label class="form-label" for="replacementText">Replacement Text</label>
            <textarea
              id="replacementText"
              class="dialog-textarea"
              rows="3"
              [(ngModel)]="replacementForm.text"
              placeholder="Enter replacement text..."
              (keydown.control.enter)="applyReplacement()"
            ></textarea>
          </div>

          <!-- Typography Controls Grid -->
          <div class="controls-grid">
            <!-- Font Family -->
            <div class="form-group">
              <label class="form-label" for="dialogFontFamily">Font</label>
              <select
                id="dialogFontFamily"
                class="dialog-select"
                [(ngModel)]="replacementForm.fontFamily"
              >
                <option value="Helvetica">Helvetica / Arial</option>
                <option value="TimesRoman">Times New Roman</option>
                <option value="Courier">Courier / Monospace</option>
              </select>
            </div>

            <!-- Font Size -->
            <div class="form-group">
              <label class="form-label" for="dialogFontSize">Size</label>
              <input
                id="dialogFontSize"
                type="number"
                min="6"
                max="120"
                class="dialog-number-input"
                [(ngModel)]="replacementForm.fontSize"
              />
            </div>

            <!-- Text Color -->
            <div class="form-group">
              <label class="form-label" for="dialogTextColor">Text Color</label>
              <input
                id="dialogTextColor"
                type="color"
                class="dialog-color-picker"
                [(ngModel)]="replacementForm.color"
              />
            </div>

            <!-- Background Cover Color -->
            <div class="form-group">
              <label class="form-label" for="dialogBgColor">Cover Background</label>
              <div class="color-picker-wrap">
                <input
                  id="dialogBgColor"
                  type="color"
                  class="dialog-color-picker"
                  [(ngModel)]="replacementForm.backgroundColor"
                  title="Adjustable background cover color matching page surface"
                />
                <span class="color-hex">{{ replacementForm.backgroundColor }}</span>
              </div>
            </div>
          </div>

          <!-- Style Toggles & Alignment -->
          <div class="toggles-row">
            <div class="btn-group-toggle">
              <button
                type="button"
                class="btn-toggle-option"
                [class.active]="replacementForm.isBold"
                (click)="replacementForm.isBold = !replacementForm.isBold"
                title="Bold"
              >
                <app-icon name="bold" [size]="14"></app-icon>
              </button>
              <button
                type="button"
                class="btn-toggle-option"
                [class.active]="replacementForm.isItalic"
                (click)="replacementForm.isItalic = !replacementForm.isItalic"
                title="Italic"
              >
                <app-icon name="italic" [size]="14"></app-icon>
              </button>
            </div>

            <div class="btn-group-toggle">
              <button
                type="button"
                class="btn-toggle-option"
                [class.active]="replacementForm.align === 'left'"
                (click)="replacementForm.align = 'left'"
                title="Align Left"
              >
                <app-icon name="align-left" [size]="14"></app-icon>
              </button>
              <button
                type="button"
                class="btn-toggle-option"
                [class.active]="replacementForm.align === 'center'"
                (click)="replacementForm.align = 'center'"
                title="Align Center"
              >
                <app-icon name="align-center" [size]="14"></app-icon>
              </button>
              <button
                type="button"
                class="btn-toggle-option"
                [class.active]="replacementForm.align === 'right'"
                (click)="replacementForm.align = 'right'"
                title="Align Right"
              >
                <app-icon name="align-right" [size]="14"></app-icon>
              </button>
            </div>
          </div>

          <!-- Dialog Actions -->
          <div class="dialog-actions">
            <button
              type="button"
              class="btn-dialog-secondary"
              (click)="closeReplacementDialog()"
            >
              Cancel
            </button>
            <button
              type="button"
              class="btn-dialog-primary"
              (click)="applyReplacement()"
            >
              Apply Replacement
            </button>
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

    /* Interactive Extracted Text Layer for Edit Mode */
    .extracted-text-layer {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: auto;
      z-index: 10;
    }
    .text-item-target {
      position: absolute;
      cursor: pointer;
      box-sizing: border-box;
      border: 1px dashed transparent;
      border-radius: 2px;
      transition: all 0.15s ease;
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
    }
    .text-item-target:hover,
    .text-item-target.hovered {
      background: rgba(14, 165, 233, 0.15);
      border-color: #0284c7;
      outline: 1px solid rgba(2, 132, 199, 0.5);
    }
    .text-target-hint {
      position: absolute;
      top: -14px;
      right: 0;
      background: #0284c7;
      color: #ffffff;
      font-size: 0.625rem;
      font-weight: 600;
      padding: 0 0.25rem;
      border-radius: 2px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s ease;
      white-space: nowrap;
    }
    .text-item-target:hover .text-target-hint,
    .text-item-target.hovered .text-target-hint {
      opacity: 1;
    }

    /* Text Replacement Annotation */
    .replace-cover-bg {
      position: absolute;
      inset: 0;
      border-radius: 1px;
      pointer-events: none;
    }
    .text-replace-content {
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      user-select: none;
    }

    /* Replacement Inline Modal Dialog */
    .replacement-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(3px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }
    .replacement-dialog {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 0.75rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      width: 100%;
      max-width: 520px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      color: #f8fafc;
      animation: dialogPop 0.15s ease-out;
    }
    @keyframes dialogPop {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .dialog-title-wrap {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #38bdf8;
    }
    .dialog-title {
      font-size: 0.9375rem;
      font-weight: 700;
      color: #f8fafc;
    }
    .dialog-close-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 0.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .dialog-close-btn:hover {
      background: #334155;
      color: #ffffff;
    }
    .dialog-disclosure-alert {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: #fbbf24;
      padding: 0.6rem 0.75rem;
      border-radius: 0.5rem;
      font-size: 0.75rem;
      line-height: 1.4;
    }
    .alert-icon {
      flex-shrink: 0;
      margin-top: 1px;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .form-label {
      font-size: 0.75rem;
      font-weight: 500;
      color: #94a3b8;
    }
    .dialog-textarea {
      width: 100%;
      background: #0f172a;
      border: 1px solid #334155;
      color: #f8fafc;
      padding: 0.5rem 0.75rem;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      line-height: 1.4;
      resize: vertical;
      outline: none;
      box-sizing: border-box;
      font-family: inherit;
    }
    .dialog-textarea:focus {
      border-color: #0284c7;
    }
    .controls-grid {
      display: grid;
      grid-template-columns: 1fr 70px 60px 1fr;
      gap: 0.75rem;
      align-items: flex-end;
    }
    .dialog-select {
      background: #0f172a;
      border: 1px solid #334155;
      color: #f8fafc;
      padding: 0.4rem 0.5rem;
      border-radius: 0.375rem;
      font-size: 0.78125rem;
      outline: none;
      width: 100%;
    }
    .dialog-number-input {
      background: #0f172a;
      border: 1px solid #334155;
      color: #f8fafc;
      padding: 0.4rem 0.5rem;
      border-radius: 0.375rem;
      font-size: 0.78125rem;
      outline: none;
      width: 100%;
      box-sizing: border-box;
    }
    .dialog-color-picker {
      width: 32px;
      height: 32px;
      padding: 0;
      border: 1px solid #475569;
      border-radius: 0.375rem;
      background: transparent;
      cursor: pointer;
    }
    .color-picker-wrap {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .color-hex {
      font-size: 0.75rem;
      font-family: monospace;
      color: #cbd5e1;
    }
    .toggles-row {
      display: flex;
      gap: 0.75rem;
    }
    .btn-group-toggle {
      display: flex;
      border: 1px solid #334155;
      border-radius: 0.375rem;
      overflow: hidden;
      background: #0f172a;
    }
    .btn-toggle-option {
      background: transparent;
      border: none;
      color: #94a3b8;
      padding: 0.35rem 0.6rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-right: 1px solid #334155;
    }
    .btn-toggle-option:last-child {
      border-right: none;
    }
    .btn-toggle-option:hover {
      background: #1e293b;
      color: #ffffff;
    }
    .btn-toggle-option.active {
      background: #0284c7;
      color: #ffffff;
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 0.5rem;
    }
    .btn-dialog-secondary {
      background: transparent;
      border: 1px solid #334155;
      color: #cbd5e1;
      padding: 0.45rem 0.9rem;
      border-radius: 0.375rem;
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-dialog-secondary:hover {
      background: #334155;
      color: #ffffff;
    }
    .btn-dialog-primary {
      background: #0284c7;
      border: none;
      color: #ffffff;
      padding: 0.45rem 1rem;
      border-radius: 0.375rem;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .btn-dialog-primary:hover {
      background: #0369a1;
    }
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

  pageTextItems: ExtractedTextItem[] = [];
  hoveredTextId: string | null = null;
  isReplacementDialogOpen = false;
  replacementTargetItem: ExtractedTextItem | null = null;
  editingReplacementId: string | null = null;
  replacementForm = {
    text: '',
    fontSize: 14,
    fontFamily: 'Helvetica' as StandardFontFamily,
    color: '#000000',
    backgroundColor: '#ffffff',
    align: 'left' as 'left' | 'center' | 'right',
    isBold: false,
    isItalic: false
  };

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

      // Extract positioned text items from page
      this.pageTextItems = await this.pdfLoader.extractPageTextItems(
        page,
        this.pageMeta,
        this.coordinateService
      );
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

  asReplace(ann: Annotation): TextReplacementAnnotation {
    return ann as TextReplacementAnnotation;
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

  onTextItemClick(event: MouseEvent, item: ExtractedTextItem): void {
    event.stopPropagation();
    this.openReplacementDialogForItem(item);
  }

  openReplacementDialogForItem(item: ExtractedTextItem): void {
    if (!this.pageMeta) return;

    // Check if there is already an existing replacement covering this item
    const existingReplacement = this.state.annotations().find(
      (a) =>
        a.pageIndex === this.pageMeta!.pageIndex &&
        a.type === 'text-replace' &&
        Math.abs(a.x - item.x) < 8 &&
        Math.abs(a.y - item.y) < 8
    ) as TextReplacementAnnotation | undefined;

    if (existingReplacement) {
      this.openEditModalForAnnotation(existingReplacement);
      return;
    }

    this.replacementTargetItem = item;
    this.editingReplacementId = null;

    // Auto-sample background color from canvas at this item's location
    const canvas = this.pdfCanvasRef?.nativeElement || null;
    const sampledBg = this.pdfLoader.sampleCanvasColorAt(
      canvas,
      item.x,
      item.y,
      this.state.zoom()
    );

    this.replacementForm = {
      text: item.str,
      fontSize: item.fontSize,
      fontFamily: item.fontFamily,
      color: '#000000',
      backgroundColor: sampledBg,
      align: 'left',
      isBold: false,
      isItalic: false
    };

    this.isReplacementDialogOpen = true;
  }

  openEditModalForAnnotation(ann: TextReplacementAnnotation): void {
    this.editingReplacementId = ann.id;
    this.replacementTargetItem = null;

    this.replacementForm = {
      text: ann.text,
      fontSize: ann.fontSize,
      fontFamily: ann.fontFamily,
      color: ann.color,
      backgroundColor: ann.backgroundColor || '#ffffff',
      align: ann.align,
      isBold: ann.isBold,
      isItalic: ann.isItalic
    };

    this.isReplacementDialogOpen = true;
  }

  closeReplacementDialog(): void {
    this.isReplacementDialogOpen = false;
    this.replacementTargetItem = null;
    this.editingReplacementId = null;
  }

  applyReplacement(): void {
    if (!this.pageMeta) return;

    const form = this.replacementForm;
    if (this.editingReplacementId) {
      // Update existing replacement annotation
      this.state.updateAnnotation(this.editingReplacementId, {
        text: form.text,
        fontSize: form.fontSize,
        fontFamily: form.fontFamily,
        color: form.color,
        backgroundColor: form.backgroundColor,
        align: form.align,
        isBold: form.isBold,
        isItalic: form.isItalic
      });
      this.state.selectAnnotation(this.editingReplacementId);
    } else if (this.replacementTargetItem) {
      const item = this.replacementTargetItem;
      const padX = 2;
      const padY = 1;
      const targetBounds = {
        x: Math.max(0, item.x - padX),
        y: Math.max(0, item.y - padY),
        width: item.width + padX * 2,
        height: item.height + padY * 2
      };

      const newReplacement: TextReplacementAnnotation = {
        id: `replace-${Date.now()}`,
        type: 'text-replace',
        pageIndex: this.pageMeta.pageIndex,
        x: targetBounds.x,
        y: targetBounds.y,
        width: targetBounds.width,
        height: targetBounds.height,
        rotation: 0,
        opacity: 1,
        zIndex: (Date.now() % 1000) + 10,
        originalText: item.str,
        text: form.text,
        fontSize: form.fontSize,
        fontFamily: form.fontFamily,
        color: form.color,
        backgroundColor: form.backgroundColor,
        align: form.align,
        isBold: form.isBold,
        isItalic: form.isItalic,
        targetBounds
      };

      this.state.addAnnotation(newReplacement);
      this.state.selectAnnotation(newReplacement.id);
    }

    this.closeReplacementDialog();
  }

  // Pointer & Click handling on Viewport / Background
  onViewportPointerDown(event: PointerEvent): void {
    if (event.target !== event.currentTarget) return;

    const tool = this.state.activeTool();
    if (tool === 'select' || tool === 'edit-text') {
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
