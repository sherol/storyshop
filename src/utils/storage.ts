import { BROTHERS } from '../engine/samples';
import type { StorySpec, Variation } from '../engine/types';

const KEY = 'storyshop:v1';

export interface SavedState {
  spec: StorySpec;
  n: number;
  seed: number;
  spun: Variation[];
  kept: Variation[];
}

export const DEFAULT_STATE: SavedState = { spec: BROTHERS, n: 6, seed: 1, spun: [], kept: [] };

export function load(): SavedState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<SavedState>) };
  } catch {
    return DEFAULT_STATE;
  }
}

export function save(state: SavedState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: the session still works, it just won't be remembered.
  }
}

export function newId(prefix: string): string {
  return `${prefix}${Math.random().toString(36).slice(2, 8)}`;
}

export function download(filename: string, text: string, type = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
