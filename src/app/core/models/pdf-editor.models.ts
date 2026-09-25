export type AnnotationType = 'text' | 'image' | 'cover' | 'text-replace';

export type StandardFontFamily = 'Helvetica' | 'TimesRoman' | 'Courier';

export interface BaseAnnotation {
  id: string;
  type: AnnotationType;
  pageIndex: number; // 0-based page index
  x: number;         // PDF points from page visual left
  y: number;         // PDF points from page visual top
  width: number;     // PDF points
  height: number;    // PDF points
  rotation: number;  // element rotation in degrees (0-360)
  opacity: number;   // 0.0 to 1.0
  zIndex: number;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  text: string;
  fontSize: number;    // PDF points
  fontFamily: StandardFontFamily;
  color: string;       // Hex color e.g. '#000000'
  isBold: boolean;
  isItalic: boolean;
  align: 'left' | 'center' | 'right';
}

export interface TextReplacementAnnotation extends BaseAnnotation {
  type: 'text-replace';
  originalText: string;
  text: string;
  fontSize: number;    // PDF points
  fontFamily: StandardFontFamily;
  color: string;       // Hex color e.g. '#000000'
  backgroundColor: string; // Hex color e.g. '#ffffff' to visually cover original text
  isBold: boolean;
  isItalic: boolean;
  align: 'left' | 'center' | 'right';
  targetBounds?: { x: number; y: number; width: number; height: number };
}

export interface ImageAnnotation extends BaseAnnotation {
  type: 'image';
  dataUrl: string;     // base64 data URL (PNG/JPEG)
  mimeType: 'image/png' | 'image/jpeg';
  isSignature?: boolean;
  aspectRatio: number; // naturalWidth / naturalHeight
}

export interface CoverAnnotation extends BaseAnnotation {
  type: 'cover';
  fillColor: string;   // default '#ffffff'
  borderColor?: string;
  borderWidth?: number;
}

export type Annotation = TextAnnotation | ImageAnnotation | CoverAnnotation | TextReplacementAnnotation;

export interface PageMeta {
  pageIndex: number;         // current index in the active pages array
  originalPageIndex: number; // original page index in source PDF
  pageNumber: number;        // display page number (1-indexed)
  width: number;             // PDF points unrotated
  height: number;            // PDF points unrotated
  rotation: number;          // additional rotation in degrees: 0, 90, 180, 270
  thumbnailUrl?: string;
  hasRendered?: boolean;
  isDeleted?: boolean;
}

export type EditorTool = 'select' | 'text' | 'image' | 'signature' | 'cover' | 'hand' | 'edit-text';

export interface ExtractedTextItem {
  id: string;
  pageIndex: number;
  str: string;
  dir: string;
  x: number;      // visual unscaled PDF points
  y: number;      // visual unscaled PDF points
  width: number;  // visual unscaled PDF points
  height: number; // visual unscaled PDF points
  fontSize: number;
  fontFamily: StandardFontFamily;
  hasEOL: boolean;
  transform: number[];
}

export type TransformHandle =
  | 'tl' | 'tc' | 'tr'
  | 'ml'        | 'mr'
  | 'bl' | 'bc' | 'br'
  | 'rot';

export interface DocumentInfo {
  name: string;
  sizeBytes: number;
  pageCount: number;
  rawBytes: Uint8Array;
}

export interface EditorAction {
  id: string;
  description: string;
  undo: () => void;
  redo: () => void;
}

export interface SearchMatch {
  pageIndex: number;
  matchIndex: number;
  textSnippet: string;
}

export interface ExportOptions {
  scope: 'all' | 'current' | 'custom';
  customPages?: number[];
  fileName?: string;
}
