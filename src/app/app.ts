import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LandingPageComponent } from './features/landing/landing-page.component';
import { EditorWorkspaceComponent } from './features/editor/editor-workspace.component';
import { EditorStateService } from './core/services/editor-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, LandingPageComponent, EditorWorkspaceComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  state = inject(EditorStateService);

  readonly activePdfDoc = signal<any>(null);

  onDocumentLoaded(pdfDoc: any): void {
    this.activePdfDoc.set(pdfDoc);
  }

  onResetDocument(): void {
    this.activePdfDoc.set(null);
    this.state.resetDocument();
  }
}
