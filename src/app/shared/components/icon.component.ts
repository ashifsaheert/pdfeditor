import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
      [class]="customClass"
      aria-hidden="true"
    >
      <ng-container [ngSwitch]="name">
        <!-- Select / Pointer Tool -->
        <g *ngSwitchCase="'select'">
          <path d="M3 3l7 18 3-7 7-3L3 3z" />
          <path d="M13 13l6 6" />
        </g>

        <!-- Text Tool -->
        <g *ngSwitchCase="'text'">
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </g>

        <!-- Edit Existing Text Tool -->
        <g *ngSwitchCase="'edit-text'">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </g>

        <!-- Image Tool -->
        <g *ngSwitchCase="'image'">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </g>

        <!-- Signature Tool -->
        <g *ngSwitchCase="'signature'">
          <path d="M20 19.5c-3 0-5.5-2.5-5.5-5.5s2.5-5.5 5.5-5.5c1.5 0 2.8.6 3.8 1.6" />
          <path d="M2 18.5c1.5-.5 3-1.5 4.5-1.5s2.5 1 4 1 3-1.5 4.5-1.5" />
          <path d="M3 12c1.5-3 3-5 5-5s3 3 4 5" />
        </g>

        <!-- Cover-up / Redaction Tool -->
        <g *ngSwitchCase="'cover'">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <line x1="3" y1="12" x2="21" y2="12" stroke-dasharray="2 2" />
        </g>

        <!-- Undo -->
        <g *ngSwitchCase="'undo'">
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </g>

        <!-- Redo -->
        <g *ngSwitchCase="'redo'">
          <path d="M21 7v6h-6" />
          <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
        </g>

        <!-- Zoom In -->
        <g *ngSwitchCase="'zoom-in'">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </g>

        <!-- Zoom Out -->
        <g *ngSwitchCase="'zoom-out'">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </g>

        <!-- Fit Page -->
        <g *ngSwitchCase="'fit-page'">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </g>

        <!-- Fit Width -->
        <g *ngSwitchCase="'fit-width'">
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </g>

        <!-- Rotate CW -->
        <g *ngSwitchCase="'rotate-cw'">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </g>

        <!-- Trash / Delete -->
        <g *ngSwitchCase="'trash'">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </g>

        <!-- Download / Export -->
        <g *ngSwitchCase="'download'">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </g>

        <!-- Upload -->
        <g *ngSwitchCase="'upload'">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </g>

        <!-- Search -->
        <g *ngSwitchCase="'search'">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </g>

        <!-- Move Up -->
        <g *ngSwitchCase="'chevron-up'">
          <polyline points="18 15 12 9 6 15" />
        </g>

        <!-- Move Down -->
        <g *ngSwitchCase="'chevron-down'">
          <polyline points="6 9 12 15 18 9" />
        </g>

        <!-- Chevron Left -->
        <g *ngSwitchCase="'chevron-left'">
          <polyline points="15 18 9 12 15 6" />
        </g>

        <!-- Chevron Right -->
        <g *ngSwitchCase="'chevron-right'">
          <polyline points="9 18 15 12 9 6" />
        </g>

        <!-- Check -->
        <g *ngSwitchCase="'check'">
          <polyline points="20 6 9 17 4 12" />
        </g>

        <!-- Close / Cross -->
        <g *ngSwitchCase="'close'">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </g>

        <!-- Bold -->
        <g *ngSwitchCase="'bold'">
          <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
          <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
        </g>

        <!-- Italic -->
        <g *ngSwitchCase="'italic'">
          <line x1="19" y1="4" x2="10" y2="4" />
          <line x1="14" y1="20" x2="5" y2="20" />
          <line x1="15" y1="4" x2="9" y2="20" />
        </g>

        <!-- Align Left -->
        <g *ngSwitchCase="'align-left'">
          <line x1="17" y1="10" x2="3" y2="10" />
          <line x1="21" y1="6" x2="3" y2="6" />
          <line x1="21" y1="14" x2="3" y2="14" />
          <line x1="17" y1="18" x2="3" y2="18" />
        </g>

        <!-- Align Center -->
        <g *ngSwitchCase="'align-center'">
          <line x1="18" y1="10" x2="6" y2="10" />
          <line x1="21" y1="6" x2="3" y2="6" />
          <line x1="21" y1="14" x2="3" y2="14" />
          <line x1="18" y1="18" x2="6" y2="18" />
        </g>

        <!-- Align Right -->
        <g *ngSwitchCase="'align-right'">
          <line x1="21" y1="10" x2="7" y2="10" />
          <line x1="21" y1="6" x2="3" y2="6" />
          <line x1="21" y1="14" x2="3" y2="14" />
          <line x1="21" y1="18" x2="7" y2="18" />
        </g>

        <!-- Layers / Z-Index -->
        <g *ngSwitchCase="'layers'">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </g>

        <!-- Shield / Privacy -->
        <g *ngSwitchCase="'shield'">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </g>

        <!-- Sparkles -->
        <g *ngSwitchCase="'sparkles'">
          <path d="M12 3v3m0 12v3m9-9h-3M6 12H3m14.36-5.64l-2.12 2.12M7.76 16.24l-2.12 2.12m12.72 0l-2.12-2.12M7.76 7.76L5.64 5.64" />
        </g>

        <!-- File PDF -->
        <g *ngSwitchCase="'file-pdf'">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </g>

        <!-- Default fallback dot -->
        <g *ngSwitchDefault>
          <circle cx="12" cy="12" r="6" />
        </g>
      </ng-container>
    </svg>
  `
})
export class IconComponent {
  @Input() name: string = '';
  @Input() size: number = 18;
  @Input() strokeWidth: number = 2;
  @Input() customClass: string = '';
}
