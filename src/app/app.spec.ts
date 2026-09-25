import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should display landing page initially when no document is loaded', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-landing-page')).toBeTruthy();
    expect(compiled.querySelector('app-editor-workspace')).toBeNull();
  });

  it('should switch to editor workspace when document is loaded and revert on reset', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    // Simulate document loaded
    app.onDocumentLoaded({ numPages: 1, getPage: () => Promise.resolve({}) });
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-editor-workspace')).toBeTruthy();
    expect(compiled.querySelector('app-landing-page')).toBeNull();

    // Reset document
    app.onResetDocument();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(compiled.querySelector('app-landing-page')).toBeTruthy();
    expect(compiled.querySelector('app-editor-workspace')).toBeNull();
  });
});
