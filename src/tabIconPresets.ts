/**
 * Built-in tab icons: generic glyphs on a coloured tile, so they read on both
 * light and dark tab strips. Inline SVG — nothing is fetched.
 */

export interface TabIconPreset {
  id: string;
  label: string;
  dataUrl: string;
}

interface Glyph {
  id: string;
  label: string;
  color: string;
  /** SVG markup drawn in white on a 24×24 grid. */
  body: string;
}

const GLYPHS: Glyph[] = [
  {
    id: 'globe',
    label: 'Globe',
    color: '#2563eb',
    body: '<circle cx="12" cy="12" r="7"/><path d="M5 12h14M12 5c2.2 2 2.2 12 0 14M12 5c-2.2 2-2.2 12 0 14"/>',
  },
  {
    id: 'document',
    label: 'Document',
    color: '#1d4ed8',
    body: '<path d="M8 5h6l3 3v11H8z"/><path d="M10.5 12h4M10.5 15h4"/>',
  },
  {
    id: 'sheet',
    label: 'Spreadsheet',
    color: '#16a34a',
    body: '<rect x="6" y="6" width="12" height="12" rx="1"/><path d="M6 10h12M6 14h12M11 6v12"/>',
  },
  {
    id: 'slides',
    label: 'Slides',
    color: '#ea580c',
    body: '<rect x="5" y="7" width="14" height="9" rx="1"/><path d="M12 16v3M9 19h6"/>',
  },
  {
    id: 'mail',
    label: 'Mail',
    color: '#dc2626',
    body: '<rect x="5" y="7" width="14" height="10" rx="1"/><path d="m5.5 7.5 6.5 5 6.5-5"/>',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    color: '#0891b2',
    body: '<rect x="5" y="6.5" width="14" height="12" rx="1"/><path d="M5 10.5h14M9 5v3M15 5v3"/>',
  },
  {
    id: 'folder',
    label: 'Folder',
    color: '#ca8a04',
    body: '<path d="M5 8a1 1 0 0 1 1-1h4l2 2h6a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/>',
  },
  {
    id: 'book',
    label: 'Book',
    color: '#7c3aed',
    body: '<path d="M12 7.5C10 6 7.5 6 5.5 6.5v11c2-.5 4.5-.5 6.5 1 2-1.5 4.5-1.5 6.5-1v-11C16.5 6 14 6 12 7.5zM12 7.5v11"/>',
  },
  {
    id: 'graduation',
    label: 'Graduation cap',
    color: '#1e3a8a',
    body: '<path d="m4.5 10 7.5-3.5 7.5 3.5-7.5 3.5z"/><path d="M8 11.7v3.3c1.2 1.3 6.8 1.3 8 0v-3.3M19.5 10v4.5"/>',
  },
  {
    id: 'school',
    label: 'School',
    color: '#b91c1c',
    body: '<path d="M5.5 18.5h13M7 18.5v-7h10v7M5.5 11.5 12 7l6.5 4.5"/><path d="M12 7V4.5h2.5M10.5 18.5v-3h3v3"/>',
  },
  {
    id: 'pencil',
    label: 'Pencil',
    color: '#f59e0b',
    body: '<path d="M15.5 5.5 18.5 8.5 9 18H6v-3z"/><path d="m13.5 7.5 3 3"/>',
  },
  {
    id: 'lightbulb',
    label: 'Idea',
    color: '#ca8a04',
    body: '<path d="M9.5 15c0-1.5-2.5-2.6-2.5-5.5a5 5 0 0 1 10 0c0 2.9-2.5 4-2.5 5.5z"/><path d="M10 17.5h4M11 19.5h2"/>',
  },
  {
    id: 'calculator',
    label: 'Calculator',
    color: '#334155',
    body: '<rect x="7" y="5" width="10" height="14" rx="1.5"/><path d="M9.5 8h5M9.5 12h.01M12 12h.01M14.5 12h.01M9.5 15h.01M12 15h.01M14.5 15h.01"/>',
  },
  {
    id: 'science',
    label: 'Science',
    color: '#0e7490',
    body: '<path d="M10 5h4M10.5 5v5L6.5 17a1 1 0 0 0 .9 1.5h9.2a1 1 0 0 0 .9-1.5l-4-7V5"/><path d="M8.5 14.5h7"/>',
  },
  {
    id: 'language',
    label: 'Languages',
    color: '#9333ea',
    body: '<path d="M5 7h7M8.5 5.5V7c0 3-1.5 5.5-3.5 6.5M7 10c.8 1.5 2.2 2.6 4 3.2"/><path d="m12.5 18.5 3-7 3 7M13.5 16.5h4"/>',
  },
  {
    id: 'note',
    label: 'Notes',
    color: '#d97706',
    body: '<path d="M7 5h10v14H7z"/><path d="M9.5 9h5M9.5 12h5M9.5 15h3"/>',
  },
  {
    id: 'chart',
    label: 'Chart',
    color: '#0d9488',
    body: '<path d="M6 18h12"/><path d="M8.5 15v-4M12 15V8M15.5 15v-6"/>',
  },
  {
    id: 'search',
    label: 'Search',
    color: '#4f46e5',
    body: '<circle cx="11" cy="11" r="4.5"/><path d="m14.5 14.5 3.5 3.5"/>',
  },
  {
    id: 'home',
    label: 'Home',
    color: '#059669',
    body: '<path d="M5.5 11.5 12 6l6.5 5.5"/><path d="M7.5 10v8h9v-8M10.5 18v-4h3v4"/>',
  },
  {
    id: 'star',
    label: 'Star',
    color: '#eab308',
    body: '<path d="m12 5.5 2 4.2 4.5.6-3.3 3.1.8 4.5-4-2.2-4 2.2.8-4.5-3.3-3.1 4.5-.6z"/>',
  },
  {
    id: 'heart',
    label: 'Heart',
    color: '#e11d48',
    body: '<path d="M12 18s-6-3.6-6-8a3.3 3.3 0 0 1 6-1.9A3.3 3.3 0 0 1 18 10c0 4.4-6 8-6 8z"/>',
  },
  {
    id: 'music',
    label: 'Music',
    color: '#c026d3',
    body: '<path d="M10 16.5V7l8-1.5V15"/><circle cx="8" cy="16.5" r="2"/><circle cx="16" cy="15" r="2"/>',
  },
  {
    id: 'shield',
    label: 'Shield',
    color: '#475569',
    body: '<path d="M12 5 6.5 7v4.5c0 3.4 2.4 5.8 5.5 7 3.1-1.2 5.5-3.6 5.5-7V7z"/><path d="m9.5 12 1.8 1.8 3.2-3.3"/>',
  },
  // Plain shapes, filled so they read as solid marks at tab size.
  {
    id: 'circle',
    label: 'Circle',
    color: '#2563eb',
    body: '<circle cx="12" cy="12" r="6" fill="#fff"/>',
  },
  {
    id: 'square',
    label: 'Square',
    color: '#16a34a',
    body: '<rect x="6.5" y="6.5" width="11" height="11" rx="1" fill="#fff"/>',
  },
  {
    id: 'triangle',
    label: 'Triangle',
    color: '#ea580c',
    body: '<path d="M12 6 18.5 17.5h-13z" fill="#fff"/>',
  },
  {
    id: 'diamond',
    label: 'Diamond',
    color: '#db2777',
    body: '<path d="m12 5 7 7-7 7-7-7z" fill="#fff"/>',
  },
  {
    id: 'hexagon',
    label: 'Hexagon',
    color: '#7c3aed',
    body: '<path d="m12 5.5 5.6 3.25v6.5L12 18.5l-5.6-3.25v-6.5z" fill="#fff"/>',
  },
  {
    id: 'ring',
    label: 'Ring',
    color: '#0f172a',
    body: '<circle cx="12" cy="12" r="5.5" stroke-width="2.4"/>',
  },
];

function toDataUrl({ color, body }: Glyph): string {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
    `<rect width="24" height="24" rx="5" fill="${color}"/>` +
    '<g fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    body +
    '</g></svg>';
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const TAB_ICON_PRESETS: TabIconPreset[] = GLYPHS.map((glyph) => ({
  id: glyph.id,
  label: glyph.label,
  dataUrl: toDataUrl(glyph),
}));
