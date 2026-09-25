import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EditorStateService } from '../../../core/services/editor-state.service';
import {
  CoverAnnotation,
  ImageAnnotation,
  StandardFontFamily,
  TextAnnotation
} from '../../../core/models/pdf-editor.models';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-property-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="property-bar" *ngIf="selected(); else defaultBar">
      <div class="prop-group">
        <span class="element-badge" [ngClass]="badgeClass">{{ typeLabel }}</span>
      </div>

      <div class="divider"></div>

      <!-- TEXT PROPERTIES -->
      <ng-container *ngIf="selected()?.type === 'text'">
        <!-- Font Family -->
        <div class="prop-group">
          <label class="prop-label" for="fontFamilySelect">Font</label>
          <select
            id="fontFamilySelect"
            class="select-input"
            [ngModel]="asText().fontFamily"
            (ngModelChange)="updateTextProp('fontFamily', $event)"
          >
            <option value="Helvetica">Helvetica / Arial</option>
            <option value="TimesRoman">Times New Roman</option>
            <option value="Courier">Courier / Monospace</option>
          </select>
        </div>

        <!-- Font Size -->
        <div class="prop-group">
          <label class="prop-label" for="fontSizeSelect">Size</label>
          <select
            id="fontSizeSelect"
            class="select-input size-select"
            [ngModel]="asText().fontSize"
            (ngModelChange)="updateTextProp('fontSize', +$event)"
          >
            <option *ngFor="let s of fontSizes" [value]="s">{{ s }}pt</option>
          </select>
        </div>

        <!-- Color -->
        <div class="prop-group color-group">
          <label class="prop-label" for="textColorInput">Color</label>
          <input
            id="textColorInput"
            type="color"
            class="color-input"
            [ngModel]="asText().color"
            (ngModelChange)="updateTextProp('color', $event)"
          />
        </div>

        <!-- Bold / Italic -->
        <div class="prop-group btn-toggles">
          <button
            type="button"
            class="btn-toggle"
            [class.active]="asText().isBold"
            (click)="updateTextProp('isBold', !asText().isBold)"
            title="Bold"
          >
            <app-icon name="bold" [size]="14"></app-icon>
          </button>
          <button
            type="button"
            class="btn-toggle"
            [class.active]="asText().isItalic"
            (click)="updateTextProp('isItalic', !asText().isItalic)"
            title="Italic"
          >
            <app-icon name="italic" [size]="14"></app-icon>
          </button>
        </div>

        <!-- Alignment -->
        <div class="prop-group btn-toggles">
          <button
            type="button"
            class="btn-toggle"
            [class.active]="asText().align === 'left'"
            (click)="updateTextProp('align', 'left')"
            title="Align Left"
          >
            <app-icon name="align-left" [size]="14"></app-icon>
          </button>
          <button
            type="button"
            class="btn-toggle"
            [class.active]="asText().align === 'center'"
            (click)="updateTextProp('align', 'center')"
            title="Align Center"
          >
            <app-icon name="align-center" [size]="14"></app-icon>
          </button>
          <button
            type="button"
            class="btn-toggle"
            [class.active]="asText().align === 'right'"
            (click)="updateTextProp('align', 'right')"
            title="Align Right"
          >
            <app-icon name="align-right" [size]="14"></app-icon>
          </button>
        </div>
      </ng-container>

      <!-- IMAGE & SIGNATURE PROPERTIES -->
      <ng-container *ngIf="selected()?.type === 'image'">
        <div class="prop-group">
          <button
            type="button"
            class="btn-action"
            (click)="rotateImage()"
            title="Rotate 90 degrees clockwise"
          >
            <app-icon name="rotate-cw" [size]="14"></app-icon>
            <span>Rotate 90°</span>
          </button>
        </div>
      </ng-container>

      <!-- COVER-UP PROPERTIES -->
      <ng-container *ngIf="selected()?.type === 'cover'">
        <div class="prop-group color-group">
          <label class="prop-label" for="fillColorInput">Fill</label>
          <input
            id="fillColorInput"
            type="color"
            class="color-input"
            [ngModel]="asCover().fillColor"
            (ngModelChange)="updateCoverProp('fillColor', $event)"
          />
        </div>

        <div class="redaction-warning-badge" title="Visual cover-up only: underlying text/vector stream is not sanitized">
          <span class="warning-dot"></span>
          <span>Visual Redaction Cover-up</span>
        </div>
      </ng-container>

      <!-- COMMON: OPACITY -->
      <div class="prop-group opacity-group">
        <label class="prop-label" for="opacityRange">Opacity: {{ (selected()!.opacity * 100).toFixed(0) }}%</label>
        <input
          id="opacityRange"
          type="range"
          min="0.1"
          max="1.0"
          step="0.05"
          class="range-slider"
          [ngModel]="selected()!.opacity"
          (ngModelChange)="updateOpacity($event)"
        />
      </div>

      <div class="divider"></div>

      <!-- COMMON: Z-INDEX & ACTIONS -->
      <div class="prop-group">
        <button
          type="button"
          class="btn-icon"
          (click)="state.bringToFront(selected()!.id)"
          title="Bring to Front"
        >
          <app-icon name="layers" [size]="14"></app-icon>
        </button>
        <button
          type="button"
          class="btn-icon danger"
          (click)="state.deleteAnnotation(selected()!.id)"
          title="Delete Element (Del / Backspace)"
        >
          <app-icon name="trash" [size]="14"></app-icon>
        </button>
      </div>
    </div>

    <!-- Default Hint Bar when nothing selected -->
    <ng-template #defaultBar>
      <div class="property-bar default-bar">
        <div class="hint-text">
          <span class="hint-key">Select</span> an element to edit font, color, and size, or choose a tool from above.
        </div>
        <div class="shortcuts-hint">
          <span class="kbd">Ctrl+Z</span> Undo
          <span class="kbd">Ctrl+Y</span> Redo
          <span class="kbd">Del</span> Delete
        </div>
      </div>
    </ng-template>
  `,
  styles: [`
    .property-bar {
      height: 48px;
      background: #1e293b;
      border-bottom: 1px solid #334155;
      display: flex;
      align-items: center;
      padding: 0 1.25rem;
      gap: 1rem;
      overflow-x: auto;
      flex-shrink: 0;
      color: #f1f5f9;
      font-size: 0.8125rem;
    }
    .default-bar {
      justify-content: space-between;
      color: #94a3b8;
    }
    .hint-text {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .hint-key {
      color: #818cf8;
      font-weight: 600;
    }
    .shortcuts-hint {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.75rem;
      color: #64748b;
    }
    .kbd {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 0.25rem;
      padding: 0.125rem 0.375rem;
      color: #94a3b8;
      font-family: monospace;
      font-size: 0.7rem;
    }
    .prop-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .prop-label {
      color: #94a3b8;
      font-size: 0.75rem;
      font-weight: 500;
      white-space: nowrap;
    }
    .element-badge {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      padding: 0.2rem 0.5rem;
      border-radius: 0.375rem;
      letter-spacing: 0.05em;
    }
    .badge-text {
      background: rgba(99, 102, 241, 0.15);
      color: #818cf8;
      border: 1px solid rgba(99, 102, 241, 0.3);
    }
    .badge-image {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .badge-cover {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    .divider {
      width: 1px;
      height: 20px;
      background: #334155;
      flex-shrink: 0;
    }
    .select-input {
      background: #0f172a;
      border: 1px solid #334155;
      color: #f1f5f9;
      padding: 0.25rem 0.6rem;
      border-radius: 0.375rem;
      font-size: 0.78125rem;
      outline: none;
    }
    .select-input:focus {
      border-color: #6366f1;
    }
    .size-select {
      width: 68px;
    }
    .color-group {
      display: flex;
      align-items: center;
    }
    .color-input {
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid #475569;
      border-radius: 0.375rem;
      background: transparent;
      cursor: pointer;
    }
    .btn-toggles {
      display: flex;
      border: 1px solid #334155;
      border-radius: 0.375rem;
      overflow: hidden;
    }
    .btn-toggle {
      background: #0f172a;
      border: none;
      color: #94a3b8;
      padding: 0.3rem 0.5rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-right: 1px solid #334155;
    }
    .btn-toggle:last-child {
      border-right: none;
    }
    .btn-toggle:hover {
      background: #1e293b;
      color: #ffffff;
    }
    .btn-toggle.active {
      background: #4f46e5;
      color: #ffffff;
    }
    .opacity-group {
      min-width: 150px;
    }
    .range-slider {
      width: 90px;
      accent-color: #6366f1;
      cursor: pointer;
    }
    .btn-action {
      background: #0f172a;
      border: 1px solid #334155;
      color: #cbd5e1;
      padding: 0.25rem 0.6rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      cursor: pointer;
    }
    .btn-action:hover {
      background: #334155;
      color: #ffffff;
    }
    .btn-icon {
      background: transparent;
      border: 1px solid #334155;
      color: #94a3b8;
      padding: 0.3rem;
      border-radius: 0.375rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn-icon:hover {
      background: #334155;
      color: #ffffff;
    }
    .btn-icon.danger:hover {
      background: #dc2626;
      border-color: #dc2626;
      color: #ffffff;
    }
    .redaction-warning-badge {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: #fbbf24;
      padding: 0.25rem 0.6rem;
      border-radius: 0.375rem;
      font-size: 0.72rem;
      font-weight: 500;
    }
    .warning-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #fbbf24;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `]
})
export class PropertyBarComponent {
  state = inject(EditorStateService);

  readonly fontSizes = [8, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72];

  get selected() {
    return this.state.selectedAnnotation;
  }

  get typeLabel(): string {
    const sel = this.selected();
    if (!sel) return '';
    if (sel.type === 'text') return 'Text';
    if (sel.type === 'image') {
      return (sel as ImageAnnotation).isSignature ? 'Signature' : 'Image';
    }
    return 'Cover-Up';
  }

  get badgeClass(): string {
    const sel = this.selected();
    if (!sel) return '';
    if (sel.type === 'text') return 'badge-text';
    if (sel.type === 'image') return 'badge-image';
    return 'badge-cover';
  }

  asText(): TextAnnotation {
    return this.selected() as TextAnnotation;
  }

  asImage(): ImageAnnotation {
    return this.selected() as ImageAnnotation;
  }

  asCover(): CoverAnnotation {
    return this.selected() as CoverAnnotation;
  }

  updateTextProp(prop: keyof TextAnnotation, value: any): void {
    const sel = this.selected();
    if (!sel || sel.type !== 'text') return;
    this.state.updateAnnotation(sel.id, { [prop]: value });
  }

  updateCoverProp(prop: keyof CoverAnnotation, value: any): void {
    const sel = this.selected();
    if (!sel || sel.type !== 'cover') return;
    this.state.updateAnnotation(sel.id, { [prop]: value });
  }

  updateOpacity(value: number): void {
    const sel = this.selected();
    if (!sel) return;
    this.state.updateAnnotation(sel.id, { opacity: Number(value) });
  }

  rotateImage(): void {
    const sel = this.selected();
    if (!sel) return;
    const currentRot = sel.rotation || 0;
    this.state.updateAnnotation(sel.id, { rotation: (currentRot + 90) % 360 });
  }
}
