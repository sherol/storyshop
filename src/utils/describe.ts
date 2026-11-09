import { FRAME_LABELS } from '../engine/choices';
import type { Character, Constraint } from '../engine/types';

export function describeConstraint(c: Constraint, characters: Character[]): string {
  const name = (id: string) => characters.find((x) => x.id === id)?.name ?? '(removed)';
  switch (c.kind) {
    case 'role':
      return `${name(c.who)} ${c.mode === 'require' ? 'must be' : 'must never be'} a ${c.role}`;
    case 'theme':
      return `The story ${c.mode === 'require' ? 'must have' : 'must not have'} ${c.theme}`;
    case 'frame':
      return `No "${FRAME_LABELS[c.frame].toLowerCase()}" explanations`;
    case 'pin':
      return `Pinned: ${c.label}`;
  }
}
