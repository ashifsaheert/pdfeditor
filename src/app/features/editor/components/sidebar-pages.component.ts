import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EditorStateService } from '../../../core/services/editor-state.service';
import { PdfLoaderService } from '../../../core/services/pdf-loader.service';
import { PageMeta, SearchMatch } from '../../../core/models/pdf-editor.models';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-sidebar-pages',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <aside class="sidebar" [class.collapsed]="isCollapsed">
      <!-- Tabs Header -->
      <div class="sidebar-header">
        <div class="tab-toggles" *ngIf="!isCollapsed">
          <button
            type="button"
            class="tab-btn"
            [class.active]="activeTab === 'pages'"
            (click)="activeTab = 'pages'"
          >
            Pages ({{ state.activePages().length }})
          </button>
          <button
            type="button"
            class="tab-btn"
            [class.active]="activeTab === 'search'"
            (click)="activeTab = 'search'"
          >
            Search
          </button>
        </div>

        <button
          type="button"
          class="btn-collapse"
          (click)="isCollapsed = !isCollapsed"
          [attr.title]="isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'"
        >
          <app-icon [name]="isCollapsed ? 'chevron-right' : 'chevron-left'" [size]="16"></app-icon>
        </button>
      </div>

      <!-- PAGES LIST TAB -->
      <div *ngIf="!isCollapsed && activeTab === 'pages'" class="sidebar-body">
        <div class="thumbnails-list">
          <div
            *ngFor="let page of state.activePages(); let idx = index"
            class="thumbnail-card"
            [class.active]="state.activePageIndex() === idx"
            (click)="state.setActivePageIndex(idx)"
          >
            <!-- Card Header -->
            <div class="card-header">
              <span class="page-num">{{ page.pageNumber }}</span>
              <div class="page-actions" (click)="$event.stopPropagation()">
                <!-- Move Up -->
                <button
                  type="button"
                  class="action-btn"
                  [disabled]="idx === 0"
                  (click)="state.reorderPages(idx, idx - 1)"
                  title="Move page up"
                >
                  <app-icon name="chevron-up" [size]="12"></app-icon>
                </button>
                <!-- Move Down -->
                <button
                  type="button"
                  class="action-btn"
                  [disabled]="idx === state.activePages().length - 1"
                  (click)="state.reorderPages(idx, idx + 1)"
                  title="Move page down"
                >
                  <app-icon name="chevron-down" [size]="12"></app-icon>
                </button>
                <!-- Rotate CW -->
                <button
                  type="button"
                  class="action-btn"
                  (click)="state.rotatePage(page.pageIndex, 90)"
                  title="Rotate 90° clockwise"
                >
                  <app-icon name="rotate-cw" [size]="12"></app-icon>
                </button>
                <!-- Delete Page -->
                <button
                  type="button"
                  class="action-btn danger"
                  [disabled]="state.activePages().length <= 1"
                  (click)="requestDeletePage.emit(page)"
                  title="Delete page"
                >
                  <app-icon name="trash" [size]="12"></app-icon>
                </button>
              </div>
            </div>

            <!-- Thumbnail Preview -->
            <div class="thumbnail-preview-wrap">
              <img
                *ngIf="page.thumbnailUrl; else thumbPlaceholder"
                [src]="page.thumbnailUrl"
                alt="Page {{ page.pageNumber }} preview"
                class="thumb-img"
                [style.transform]="'rotate(' + page.rotation + 'deg)'"
              />
              <ng-template #thumbPlaceholder>
                <div class="thumb-loading">
                  <app-icon name="file-pdf" [size]="24"></app-icon>
                  <span>Loading...</span>
                </div>
              </ng-template>

              <span *ngIf="page.rotation !== 0" class="rotation-badge">
                {{ page.rotation }}°
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- SEARCH TAB -->
      <div *ngIf="!isCollapsed && activeTab === 'search'" class="sidebar-body search-body">
        <div class="search-input-wrap">
          <app-icon name="search" [size]="14" customClass="search-icon"></app-icon>
          <input
            type="text"
            class="search-input"
            placeholder="Search text in document..."
            [ngModel]="searchQuery"
            (ngModelChange)="onSearchInput($event)"
          />
          <button
            *ngIf="searchQuery"
            type="button"
            class="btn-clear-search"
            (click)="onSearchInput('')"
          >
            <app-icon name="close" [size]="12"></app-icon>
          </button>
        </div>

        <!-- Search Results Summary & Nav -->
        <div *ngIf="state.searchMatches().length > 0" class="search-nav-bar">
          <span class="match-count">
            {{ state.currentMatchIndex() + 1 }} of {{ state.searchMatches().length }} matches
          </span>
          <div class="match-nav-btns">
            <button
              type="button"
              class="btn-match-nav"
              (click)="state.prevSearchMatch()"
              title="Previous match"
            >
              <app-icon name="chevron-up" [size]="14"></app-icon>
            </button>
            <button
              type="button"
              class="btn-match-nav"
              (click)="state.nextSearchMatch()"
              title="Next match"
            >
              <app-icon name="chevron-down" [size]="14"></app-icon>
            </button>
          </div>
        </div>

        <!-- Empty Results or Searching Prompt -->
        <div *ngIf="searchQuery && state.searchMatches().length === 0 && !isSearching" class="no-matches">
          No matches found for "{{ searchQuery }}"
        </div>

        <div *ngIf="isSearching" class="no-matches">
          Searching document...
        </div>

        <!-- Match Snippets List -->
        <div class="matches-list" *ngIf="state.searchMatches().length > 0">
          <div
            *ngFor="let m of state.searchMatches(); let i = index"
            class="match-card"
            [class.active]="state.currentMatchIndex() === i"
            (click)="selectMatch(i, m.pageIndex)"
          >
            <div class="match-header">
              <span class="match-badge">Page {{ m.pageIndex + 1 }}</span>
              <span class="match-index">#{{ i + 1 }}</span>
            </div>
            <p class="match-snippet">
              ...{{ m.textSnippet }}...
            </p>
          </div>
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 240px;
      height: 100%;
      background: #111827;
      border-right: 1px solid #1f2937;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      transition: width 0.2s ease;
      overflow: hidden;
      z-index: 10;
    }
    .sidebar.collapsed {
      width: 48px;
    }
    .sidebar-header {
      height: 48px;
      padding: 0 0.75rem;
      border-bottom: 1px solid #1f2937;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .tab-toggles {
      display: flex;
      gap: 0.25rem;
    }
    .tab-btn {
      background: transparent;
      border: none;
      color: #9ca3af;
      font-size: 0.8125rem;
      font-weight: 500;
      padding: 0.35rem 0.6rem;
      border-radius: 0.375rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .tab-btn:hover {
      color: #ffffff;
      background: #1f2937;
    }
    .tab-btn.active {
      color: #ffffff;
      background: #374151;
    }
    .btn-collapse {
      background: transparent;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      padding: 0.35rem;
      border-radius: 0.375rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn-collapse:hover {
      background: #1f2937;
      color: #ffffff;
    }
    .sidebar-body {
      flex: 1;
      overflow-y: auto;
      padding: 0.75rem;
    }
    .thumbnails-list {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .thumbnail-card {
      background: #1f2937;
      border: 2px solid transparent;
      border-radius: 0.5rem;
      padding: 0.5rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .thumbnail-card:hover {
      background: #283548;
      border-color: #374151;
    }
    .thumbnail-card.active {
      border-color: #6366f1;
      background: #1e1b4b;
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }
    .page-num {
      font-size: 0.75rem;
      font-weight: 600;
      color: #9ca3af;
    }
    .thumbnail-card.active .page-num {
      color: #818cf8;
    }
    .page-actions {
      display: flex;
      gap: 0.2rem;
      opacity: 0.75;
      transition: opacity 0.15s ease;
    }
    .thumbnail-card:hover .page-actions {
      opacity: 1;
    }
    .action-btn {
      background: #111827;
      border: 1px solid #374151;
      color: #9ca3af;
      width: 20px;
      height: 20px;
      border-radius: 0.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
    }
    .action-btn:hover:not(:disabled) {
      color: #ffffff;
      background: #4b5563;
    }
    .action-btn.danger:hover:not(:disabled) {
      background: #dc2626;
      border-color: #dc2626;
      color: #ffffff;
    }
    .action-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    .thumbnail-preview-wrap {
      position: relative;
      background: #ffffff;
      border-radius: 0.375rem;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 120px;
    }
    .thumb-img {
      width: 100%;
      height: auto;
      display: block;
      transition: transform 0.2s ease;
    }
    .thumb-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
      color: #6b7280;
      font-size: 0.75rem;
      padding: 1.5rem 0;
    }
    .rotation-badge {
      position: absolute;
      bottom: 4px;
      right: 4px;
      background: rgba(15, 23, 42, 0.85);
      color: #fbbf24;
      font-size: 0.65rem;
      font-weight: 600;
      padding: 0.1rem 0.3rem;
      border-radius: 0.25rem;
    }
    .search-body {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .search-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .search-icon {
      position: absolute;
      left: 0.6rem;
      color: #6b7280;
      pointer-events: none;
    }
    .search-input {
      width: 100%;
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 0.375rem;
      color: #f9fafb;
      padding: 0.45rem 1.8rem 0.45rem 2rem;
      font-size: 0.8125rem;
      outline: none;
    }
    .search-input:focus {
      border-color: #6366f1;
    }
    .btn-clear-search {
      position: absolute;
      right: 0.5rem;
      background: transparent;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      padding: 0.15rem;
    }
    .search-nav-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #1f2937;
      padding: 0.35rem 0.6rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
    }
    .match-count {
      color: #9ca3af;
    }
    .match-nav-btns {
      display: flex;
      gap: 0.25rem;
    }
    .btn-match-nav {
      background: #111827;
      border: 1px solid #374151;
      color: #d1d5db;
      width: 22px;
      height: 22px;
      border-radius: 0.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .btn-match-nav:hover {
      background: #4b5563;
      color: #ffffff;
    }
    .no-matches {
      text-align: center;
      color: #6b7280;
      font-size: 0.78125rem;
      padding: 1.5rem 0.5rem;
    }
    .matches-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      overflow-y: auto;
    }
    .match-card {
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 0.375rem;
      padding: 0.5rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .match-card:hover {
      background: #283548;
    }
    .match-card.active {
      border-color: #6366f1;
      background: #1e1b4b;
    }
    .match-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.25rem;
    }
    .match-badge {
      font-size: 0.7rem;
      font-weight: 600;
      color: #818cf8;
    }
    .match-index {
      font-size: 0.7rem;
      color: #6b7280;
    }
    .match-snippet {
      font-size: 0.75rem;
      color: #d1d5db;
      margin: 0;
      line-height: 1.35;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
  `]
})
export class SidebarPagesComponent {
  state = inject(EditorStateService);
  pdfLoader = inject(PdfLoaderService);

  @Input() pdfDoc: any = null;
  @Output() requestDeletePage = new EventEmitter<PageMeta>();

  isCollapsed = false;
  activeTab: 'pages' | 'search' = 'pages';
  searchQuery = '';
  isSearching = false;

  private searchDebounceTimer?: any;

  onSearchInput(query: string): void {
    this.searchQuery = query;
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);

    if (!query.trim()) {
      this.state.clearSearch();
      return;
    }

    this.searchDebounceTimer = setTimeout(() => {
      this.executeSearch(query.trim());
    }, 300);
  }

  async executeSearch(query: string): Promise<void> {
    if (!this.pdfDoc) return;
    this.isSearching = true;

    try {
      const matches: SearchMatch[] = [];
      const numPages = this.pdfDoc.numPages;
      const lowerQuery = query.toLowerCase();

      for (let i = 1; i <= numPages; i++) {
        const page = await this.pdfDoc.getPage(i);
        const text = await this.pdfLoader.extractPageText(page);
        const lowerText = text.toLowerCase();

        let startIndex = 0;
        let matchIndexInPage = 0;

        while ((startIndex = lowerText.indexOf(lowerQuery, startIndex)) !== -1) {
          const snippetStart = Math.max(0, startIndex - 20);
          const snippetEnd = Math.min(text.length, startIndex + query.length + 30);
          const snippet = text.substring(snippetStart, snippetEnd).trim();

          matches.push({
            pageIndex: i - 1,
            matchIndex: matchIndexInPage++,
            textSnippet: snippet
          });

          startIndex += query.length;
        }
      }

      this.state.setSearchQuery(query, matches);
    } catch (err) {
      console.error('Error during search execution:', err);
    } finally {
      this.isSearching = false;
    }
  }

  selectMatch(matchIndex: number, pageIndex: number): void {
    this.state.currentMatchIndex.set(matchIndex);
    this.state.setActivePageIndex(pageIndex);
  }
}
