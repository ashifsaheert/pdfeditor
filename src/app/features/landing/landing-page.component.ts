import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PdfLoaderService } from '../../core/services/pdf-loader.service';
import { EditorStateService } from '../../core/services/editor-state.service';
import { PageMeta } from '../../core/models/pdf-editor.models';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="landing-container">
      <!-- Navbar -->
      <nav class="nav">
        <div class="nav-brand">
          <div class="brand-logo">
            <app-icon name="file-pdf" [size]="20"></app-icon>
          </div>
          <span class="brand-title">PDF Studio</span>
          <span class="brand-pill">Client-Side</span>
        </div>
        <div class="nav-links">
          <span class="privacy-indicator">
            <span class="green-dot"></span>
            <span>100% In-Browser Privacy</span>
          </span>
        </div>
      </nav>

      <!-- Main Hero -->
      <main class="hero-section">
        <div class="hero-badge">
          <app-icon name="shield" [size]="14"></app-icon>
          <span>Zero Server Uploads • 100% Local Browser Execution</span>
        </div>

        <h1 class="hero-title">
          Private, Full-Featured <br />
          <span class="gradient-text">PDF Editor in Your Browser</span>
        </h1>

        <p class="hero-desc">
          Add text with custom fonts, draw and place signatures, cover sensitive content,
          reorder or rotate pages, and export clean PDFs. Your files never leave your device.
        </p>

        <!-- Dropzone & Quick Action Card -->
        <div class="dropzone-card">
          <div
            class="dropzone"
            [class.drag-over]="isDragging"
            (dragover)="onDragOver($event)"
            (dragleave)="isDragging = false"
            (drop)="onFileDrop($event)"
            (click)="fileInput.click()"
          >
            <input
              #fileInput
              type="file"
              accept=".pdf,application/pdf"
              style="display: none"
              (change)="onFileInputChange($event)"
            />

            <div class="drop-icon-wrap">
              <app-icon name="upload" [size]="36"></app-icon>
            </div>

            <h3 class="drop-title">Drop your PDF here, or click to browse</h3>
            <p class="drop-subtitle">Supports multi-page PDFs, forms, and documents up to 100MB</p>

            <button type="button" class="btn btn-primary" (click)="$event.stopPropagation(); fileInput.click()">
              <app-icon name="upload" [size]="16"></app-icon>
              <span>Select PDF File</span>
            </button>
          </div>

          <!-- Divider with "or" -->
          <div class="dropzone-divider">
            <span class="divider-line"></span>
            <span class="divider-text">OR TEST INSTANTLY</span>
            <span class="divider-line"></span>
          </div>

          <!-- Sample PDF Button -->
          <div class="sample-action">
            <button
              type="button"
              class="btn btn-sample"
              [disabled]="isLoadingSample"
              (click)="loadSampleDocument()"
            >
              <app-icon name="sparkles" [size]="16"></app-icon>
              <span>{{ isLoadingSample ? 'Generating sample...' : 'Try with Sample 3-Page Document' }}</span>
            </button>
            <p class="sample-note">Loads an instant interactive sample PDF with signature placeholders</p>
          </div>
        </div>

        <!-- Features Grid -->
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon icon-shield">
              <app-icon name="shield" [size]="20"></app-icon>
            </div>
            <h4 class="feature-title">Complete Privacy</h4>
            <p class="feature-desc">
              All rendering, processing, and exports run entirely inside your browser's memory sandbox. Zero analytics or server transmission.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon icon-text">
              <app-icon name="text" [size]="20"></app-icon>
            </div>
            <h4 class="feature-title">Text & Typography</h4>
            <p class="feature-desc">
              Insert text annotations using standard Helvetica, Times, or Courier fonts, customizable font sizes, hex colors, alignments, and opacities.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon icon-sig">
              <app-icon name="signature" [size]="20"></app-icon>
            </div>
            <h4 class="feature-title">Signatures & Images</h4>
            <p class="feature-desc">
              Draw digital signatures directly with smooth stylus/touch strokes or insert transparent PNG logos with interactive transform handles.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon icon-cover">
              <app-icon name="cover" [size]="20"></app-icon>
            </div>
            <h4 class="feature-title">Visual Redaction</h4>
            <p class="feature-desc">
              Cover up unwanted sections with customizable rectangles. Explicitly communicates that visual overlays do not sanitize underlying streams.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon icon-pages">
              <app-icon name="rotate-cw" [size]="20"></app-icon>
            </div>
            <h4 class="feature-title">Page Management</h4>
            <p class="feature-desc">
              Rotate pages 90° or 180°, reorder page sequences, omit deleted pages, and export all or selected pages with full Undo/Redo.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon icon-export">
              <app-icon name="download" [size]="20"></app-icon>
            </div>
            <h4 class="feature-title">Pristine PDF Export</h4>
            <p class="feature-desc">
              Compiles a valid, downloadable PDF file preserving original document streams using pdf-lib without modifying the source file.
            </p>
          </div>
        </div>
      </main>

      <!-- Footer -->
      <footer class="footer">
        <p>PDF Studio • Built with Angular & TypeScript • Powered by PDF.js & pdf-lib • Ready for Vercel Static Hosting</p>
      </footer>
    </div>
  `,
  styles: [`
    .landing-container {
      min-height: 100vh;
      background: radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0f172a 50%, #090d16 100%);
      color: #f8fafc;
      display: flex;
      flex-direction: column;
    }
    .nav {
      height: 64px;
      padding: 0 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .nav-brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .brand-logo {
      width: 32px;
      height: 32px;
      border-radius: 0.5rem;
      background: #4f46e5;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
    }
    .brand-title {
      font-size: 1.125rem;
      font-weight: 700;
      color: #ffffff;
    }
    .brand-pill {
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid rgba(99, 102, 241, 0.4);
      color: #a5b4fc;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.15rem 0.5rem;
      border-radius: 9999px;
    }
    .privacy-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8125rem;
      color: #94a3b8;
    }
    .green-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
    }
    .hero-section {
      max-width: 900px;
      margin: 0 auto;
      padding: 3rem 1.5rem 4rem 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      flex: 1;
    }
    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(99, 102, 241, 0.12);
      border: 1px solid rgba(99, 102, 241, 0.3);
      color: #a5b4fc;
      padding: 0.4rem 1rem;
      border-radius: 9999px;
      font-size: 0.8125rem;
      font-weight: 500;
      margin-bottom: 1.5rem;
    }
    .hero-title {
      font-size: 2.75rem;
      font-weight: 800;
      line-height: 1.15;
      margin: 0 0 1.25rem 0;
      letter-spacing: -0.025em;
    }
    .gradient-text {
      background: linear-gradient(135deg, #a5b4fc 0%, #818cf8 50%, #38bdf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero-desc {
      font-size: 1.125rem;
      color: #94a3b8;
      max-width: 620px;
      line-height: 1.6;
      margin: 0 0 2.5rem 0;
    }
    .dropzone-card {
      width: 100%;
      max-width: 680px;
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 1.25rem;
      padding: 2rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
      margin-bottom: 4rem;
    }
    .dropzone {
      border: 2px dashed #475569;
      border-radius: 1rem;
      padding: 2.5rem 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      transition: all 0.2s ease;
      background: rgba(15, 23, 42, 0.4);
    }
    .dropzone:hover, .dropzone.drag-over {
      border-color: #6366f1;
      background: rgba(99, 102, 241, 0.08);
      transform: translateY(-2px);
    }
    .drop-icon-wrap {
      color: #818cf8;
      margin-bottom: 1rem;
    }
    .drop-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #f8fafc;
      margin: 0 0 0.4rem 0;
    }
    .drop-subtitle {
      font-size: 0.8125rem;
      color: #94a3b8;
      margin: 0 0 1.5rem 0;
    }
    .dropzone-divider {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin: 1.5rem 0;
    }
    .divider-line {
      flex: 1;
      height: 1px;
      background: rgba(255, 255, 255, 0.1);
    }
    .divider-text {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #64748b;
    }
    .sample-action {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .sample-note {
      font-size: 0.75rem;
      color: #64748b;
      margin: 0.5rem 0 0 0;
    }
    .btn {
      padding: 0.65rem 1.5rem;
      border-radius: 0.5rem;
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      border: none;
      transition: all 0.15s ease;
    }
    .btn-primary {
      background: #4f46e5;
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
    }
    .btn-primary:hover {
      background: #4338ca;
    }
    .btn-sample {
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.4);
      color: #c7d2fe;
      width: 100%;
      justify-content: center;
      padding: 0.75rem;
    }
    .btn-sample:hover:not(:disabled) {
      background: rgba(99, 102, 241, 0.25);
      color: #ffffff;
    }
    .btn-sample:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .features-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.5rem;
      width: 100%;
      text-align: left;
    }
    .feature-card {
      background: rgba(30, 41, 59, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 0.875rem;
      padding: 1.5rem;
      transition: transform 0.2s ease;
    }
    .feature-card:hover {
      transform: translateY(-3px);
      background: rgba(30, 41, 59, 0.7);
    }
    .feature-icon {
      width: 40px;
      height: 40px;
      border-radius: 0.625rem;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1rem;
    }
    .icon-shield { background: rgba(16, 185, 129, 0.15); color: #34d399; }
    .icon-text { background: rgba(99, 102, 241, 0.15); color: #818cf8; }
    .icon-sig { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }
    .icon-cover { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
    .icon-pages { background: rgba(168, 85, 247, 0.15); color: #c084fc; }
    .icon-export { background: rgba(236, 72, 153, 0.15); color: #f472b6; }
    .feature-title {
      font-size: 1rem;
      font-weight: 600;
      color: #f8fafc;
      margin: 0 0 0.5rem 0;
    }
    .feature-desc {
      font-size: 0.8125rem;
      color: #94a3b8;
      line-height: 1.5;
      margin: 0;
    }
    .footer {
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding: 1.5rem 2rem;
      text-align: center;
      font-size: 0.75rem;
      color: #64748b;
    }
    @media (max-width: 768px) {
      .hero-title {
        font-size: 2rem;
      }
      .features-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class LandingPageComponent {
  pdfLoader = inject(PdfLoaderService);
  state = inject(EditorStateService);

  @Output() documentLoaded = new EventEmitter<any>();

  isDragging = false;
  isLoadingSample = false;

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0 && files[0].type.includes('pdf')) {
      this.handlePdfFile(files[0]);
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handlePdfFile(input.files[0]);
    }
  }

  async handlePdfFile(file: File): Promise<void> {
    try {
      this.state.isLoading.set(true);
      this.state.loadingMessage.set('Reading PDF file...');

      const arrayBuffer = await file.arrayBuffer();
      const rawBytes = new Uint8Array(arrayBuffer);

      const pdfDoc = await this.pdfLoader.loadDocument(rawBytes);
      const pages = await this.buildPagesMetadata(pdfDoc);

      this.state.setDocument(
        {
          name: file.name,
          sizeBytes: file.size,
          pageCount: pdfDoc.numPages,
          rawBytes
        },
        pages
      );

      this.documentLoaded.emit(pdfDoc);
    } catch (err: any) {
      console.error('Error loading PDF:', err);
      alert(`Could not open PDF: ${err.message || 'Invalid or encrypted PDF'}`);
    } finally {
      this.state.isLoading.set(false);
    }
  }

  async loadSampleDocument(): Promise<void> {
    this.isLoadingSample = true;
    try {
      const sampleBytes = await this.pdfLoader.createSamplePdf();
      const pdfDoc = await this.pdfLoader.loadDocument(sampleBytes);
      const pages = await this.buildPagesMetadata(pdfDoc);

      this.state.setDocument(
        {
          name: 'PDF-Studio-Sample-Agreement.pdf',
          sizeBytes: sampleBytes.byteLength,
          pageCount: pdfDoc.numPages,
          rawBytes: sampleBytes
        },
        pages
      );

      this.documentLoaded.emit(pdfDoc);
    } catch (err: any) {
      console.error('Failed to create sample PDF:', err);
      alert('Could not initialize sample document.');
    } finally {
      this.isLoadingSample = false;
    }
  }

  private async buildPagesMetadata(pdfDoc: any): Promise<PageMeta[]> {
    const pages: PageMeta[] = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });

      // Generate thumbnail preview
      let thumbUrl = '';
      try {
        thumbUrl = await this.pdfLoader.renderThumbnail(page, 0, 160);
      } catch (e) {
        // Thumbnail fallback
      }

      pages.push({
        pageIndex: i - 1,
        originalPageIndex: i - 1,
        pageNumber: i,
        width: viewport.width,
        height: viewport.height,
        rotation: 0,
        thumbnailUrl: thumbUrl
      });
    }
    return pages;
  }
}
