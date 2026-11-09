import { choicePoints } from './choices';
import { evaluate } from './evaluate';
import { narrate } from './narrate';
import type { ChoicePoint, Choices, Constraint, StorySpec, Variation } from './types';

/** Small seeded PRNG (mulberry32) so a seed always spins the same set. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ENUMERATION_LIMIT = 5000;

export interface Enumeration {
  solutions: Choices[];
  /** True when the search stopped at the limit; there may be more tellings. */
  truncated: boolean;
}

/**
 * Every telling that satisfies the spec's constraints: a depth-first search over the open
 * questions. Pins and banned explanations prune the search early; everything else is checked
 * once a telling is complete.
 */
export function enumerate(
  spec: StorySpec,
  limit = ENUMERATION_LIMIT,
  points = choicePoints(spec),
): Enumeration {
  const pins = new Map<string, string>();
  const banned = new Set<string>();
  for (const c of spec.constraints) {
    if (c.kind === 'pin') pins.set(c.choiceId, c.optionId);
    if (c.kind === 'frame') banned.add(c.frame);
  }

  const solutions: Choices[] = [];
  let truncated = false;
  const current: Choices = {};

  const visit = (i: number): void => {
    if (truncated) return;
    if (i === points.length) {
      if (evaluate(spec, current, points).broken.length === 0) {
        if (solutions.length >= limit) {
          truncated = true;
          return;
        }
        solutions.push({ ...current });
      }
      return;
    }
    const point = points[i];
    const pinned = pins.get(point.id);
    for (const option of point.options) {
      if (pinned !== undefined && option.id !== pinned) continue;
      if (point.kind === 'frame' && banned.has(option.id.split(':')[0])) continue;
      current[point.id] = option.id;
      visit(i + 1);
    }
    delete current[point.id];
  };
  visit(0);

  return { solutions, truncated };
}

function distance(a: Choices, b: Choices, points: ChoicePoint[]): number {
  let d = 0;
  for (const p of points) {
    // Why a harm happened matters more to the story than how a bystander took it.
    if (a[p.id] !== b[p.id]) d += p.kind === 'frame' ? 3 : 1;
  }
  return d;
}

/**
 * Picks n tellings that differ from each other as much as possible (greedy farthest-point
 * sampling), so the first spin shows the range of the space, not n near-copies.
 */
export function pickDiverse(
  solutions: Choices[],
  n: number,
  seed: number,
  points: ChoicePoint[],
): Choices[] {
  if (solutions.length <= n) {
    const random = rng(seed);
    return [...solutions].sort(() => random() - 0.5);
  }
  const random = rng(seed);
  const picked: Choices[] = [solutions[Math.floor(random() * solutions.length)]];
  const nearest = solutions.map((s) => distance(s, picked[0], points));
  while (picked.length < n) {
    let best = -1;
    let bestScore = -1;
    for (let i = 0; i < solutions.length; i++) {
      // A little noise breaks ties differently for each seed.
      const score = nearest[i] + random() * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    const next = solutions[best];
    picked.push(next);
    for (let i = 0; i < solutions.length; i++) {
      nearest[i] = Math.min(nearest[i], distance(solutions[i], next, points));
    }
  }
  return picked;
}

export function choicesKey(choices: Choices): string {
  return Object.keys(choices)
    .sort()
    .map((k) => `${k}=${choices[k]}`)
    .join('|');
}

/** Short stable id for a telling. */
export function variationId(spec: StorySpec, choices: Choices): string {
  const text = `${spec.title}#${choicesKey(choices)}`;
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function buildVariation(
  spec: StorySpec,
  choices: Choices,
  points = choicePoints(spec),
): Variation {
  const { roles, themes } = evaluate(spec, choices, points);
  const { pages, logline } = narrate(spec, choices, points, roles, themes);
  return {
    id: variationId(spec, choices),
    spec,
    choices,
    pages,
    roles,
    themes,
    logline,
    overrides: {},
  };
}

export interface SpinResult {
  variations: Variation[];
  total: number;
  truncated: boolean;
  /** When nothing fits: the constraints that, dropped alone, would let a story through. */
  culprits: Constraint[];
}

export function spin(spec: StorySpec, n: number, seed: number): SpinResult {
  const points = choicePoints(spec);
  const { solutions, truncated } = enumerate(spec, ENUMERATION_LIMIT, points);
  const picked = pickDiverse(solutions, n, seed, points);
  return {
    variations: picked.map((c) => buildVariation(spec, c, points)),
    total: solutions.length,
    truncated,
    culprits: solutions.length === 0 ? diagnose(spec, points) : [],
  };
}

/** Constraints that are each, on their own, the reason no telling fits. */
export function diagnose(spec: StorySpec, points = choicePoints(spec)): Constraint[] {
  return spec.constraints.filter((c) => {
    const relaxed = { ...spec, constraints: spec.constraints.filter((x) => x.id !== c.id) };
    return enumerate(relaxed, 1, points).solutions.length > 0;
  });
}

export interface Alternative {
  optionId: string;
  label: string;
  /** False when no telling with this answer satisfies the constraints. */
  allowed: boolean;
  current: boolean;
  /**
   * The full set of answers to switch to. Usually only this question changes; when that alone
   * would break a rule, the engine also re-answers the fewest other questions it has to.
   */
  choices?: Choices;
  /** Questions besides this one that the swap re-answers. */
  alsoChanges: string[];
}

/**
 * Other answers to one question, keeping as much of the telling as possible. This is the
 * co-author's lever: swap one explanation and the engine keeps the rest consistent.
 */
export function alternatives(variation: Variation, choiceId: string): Alternative[] {
  const { spec, choices } = variation;
  const points = choicePoints(spec);
  const point = points.find((p) => p.id === choiceId);
  if (!point) return [];
  // A pin on this very question would rule out every other answer; the user is deliberately
  // revisiting it, so judge alternatives without it.
  const others = spec.constraints.filter((c) => !(c.kind === 'pin' && c.choiceId === choiceId));

  return point.options.map((o) => {
    const base = { optionId: o.id, label: o.label, current: choices[choiceId] === o.id };
    const direct = { ...choices, [choiceId]: o.id };
    if (evaluate({ ...spec, constraints: others }, direct, points).broken.length === 0) {
      return { ...base, allowed: true, choices: direct, alsoChanges: [] };
    }
    // Repair: the closest telling that gives this answer.
    const pinned: StorySpec = {
      ...spec,
      constraints: [...others, { id: 'swap', kind: 'pin', choiceId, optionId: o.id, label: '' }],
    };
    const { solutions } = enumerate(pinned, ENUMERATION_LIMIT, points);
    let best: Choices | undefined;
    let bestDistance = Infinity;
    for (const candidate of solutions) {
      const d = distance(candidate, choices, points);
      if (d < bestDistance) {
        bestDistance = d;
        best = candidate;
      }
    }
    if (!best) return { ...base, allowed: false, alsoChanges: [] };
    const changed = points
      .filter((p) => p.id !== choiceId && best[p.id] !== choices[p.id])
      .map((p) => p.question);
    return { ...base, allowed: true, choices: best, alsoChanges: changed };
  });
}

/** The telling with new answers; rewrites on pages those answers don't touch are kept. */
export function swapChoices(variation: Variation, choices: Choices): Variation {
  const changed = Object.keys(choices).filter((k) => choices[k] !== variation.choices[k]);
  const next = buildVariation(variation.spec, choices);
  const overrides: Record<number, string> = {};
  for (const [index, text] of Object.entries(variation.overrides)) {
    const page = next.pages[Number(index)];
    if (page && !page.choiceIds.some((id) => changed.includes(id))) {
      overrides[Number(index)] = text;
    }
  }
  return { ...next, overrides };
}

/** The telling with one answer changed. */
export function swapChoice(variation: Variation, choiceId: string, optionId: string): Variation {
  return swapChoices(variation, { ...variation.choices, [choiceId]: optionId });
}
