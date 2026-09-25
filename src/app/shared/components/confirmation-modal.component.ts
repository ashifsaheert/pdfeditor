import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-confirmation-modal',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div
      *ngIf="isOpen"
      class="modal-backdrop"
      (click)="onBackdropClick($event)"
      role="dialog"
      aria-modal="true"
    >
      <div class="modal-card" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="modal-header">
          <div class="modal-icon-badge" [ngClass]="isDanger ? 'badge-danger' : 'badge-warning'">
            <app-icon [name]="isDanger ? 'trash' : 'shield'" [size]="20"></app-icon>
          </div>
          <div class="modal-title-wrap">
            <h3 class="modal-title">{{ title }}</h3>
            <p class="modal-desc">{{ message }}</p>
          </div>
        </div>

        <!-- Optional Extra Details / Warning -->
        <div *ngIf="warningText" class="modal-warning-box">
          <span class="warning-tag">Note</span>
          <span class="warning-message">{{ warningText }}</span>
        </div>

        <!-- Actions -->
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" (click)="cancel.emit()">
            {{ cancelText }}
          </button>
          <button
            type="button"
            class="btn"
            [ngClass]="isDanger ? 'btn-danger' : 'btn-primary'"
            (click)="confirm.emit()"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 1rem;
      animation: fadeIn 0.15s ease-out;
    }
    .modal-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 1rem;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      padding: 1.5rem;
      color: #f8fafc;
      animation: slideUp 0.15s ease-out;
    }
    .modal-header {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      margin-bottom: 1.25rem;
    }
    .modal-icon-badge {
      width: 44px;
      height: 44px;
      border-radius: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .badge-danger {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    .badge-warning {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    .modal-title-wrap {
      flex: 1;
    }
    .modal-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #f8fafc;
      margin: 0 0 0.35rem 0;
    }
    .modal-desc {
      font-size: 0.875rem;
      color: #94a3b8;
      margin: 0;
      line-height: 1.4;
    }
    .modal-warning-box {
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.25);
      border-radius: 0.5rem;
      padding: 0.75rem;
      margin-bottom: 1.25rem;
      font-size: 0.8125rem;
      color: #fcd34d;
      display: flex;
      gap: 0.5rem;
      align-items: baseline;
    }
    .warning-tag {
      background: #b45309;
      color: #fff;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-weight: 600;
      font-size: 0.7rem;
      text-transform: uppercase;
    }
    .warning-message {
      line-height: 1.35;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }
    .btn {
      padding: 0.55rem 1.15rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: all 0.15s ease;
    }
    .btn-secondary {
      background: #334155;
      color: #cbd5e1;
    }
    .btn-secondary:hover {
      background: #475569;
      color: #ffffff;
    }
    .btn-danger {
      background: #dc2626;
      color: #ffffff;
    }
    .btn-danger:hover {
      background: #b91c1c;
    }
    .btn-primary {
      background: #4f46e5;
      color: #ffffff;
    }
    .btn-primary:hover {
      background: #4338ca;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { transform: translateY(10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `]
})
export class ConfirmationModalComponent {
  @Input() isOpen = false;
  @Input() title = 'Confirm Action';
  @Input() message = 'Are you sure you want to proceed?';
  @Input() warningText?: string;
  @Input() confirmText = 'Confirm';
  @Input() cancelText = 'Cancel';
  @Input() isDanger = false;

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancel.emit();
    }
  }
}
