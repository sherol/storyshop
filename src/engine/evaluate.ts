import { choicePoints, parseFrame } from './choices';
import type { ChoicePoint, Choices, Constraint, Evaluation, Role, StorySpec, Theme } from './types';

/**
 * Works out each character's role and the story's themes from one telling, following
 * rolemodel's `storyroles.lp`:
 *
 * - victim: harmed, unless the harm is nullified (payback for their own wrong, self-defense
 *   against them, or they no longer cared).
 * - aggressor: harmed someone on purpose, unless nullified (they were manipulated, it was an
 *   accident, self-defense, or revenge). Whoever pulled the strings is the aggressor instead.
 * - bystander: never harmed anyone, never pulled strings, and was never a victim.
 */
export function evaluate(spec: StorySpec, choices: Choices, points?: ChoicePoint[]): Evaluation {
  const victims = new Set<string>();
  const aggressors = new Set<string>();
  const actors = new Set<string>();
  const themes = new Set<Theme>();
  const broken: string[] = [];

  const manipulatorOf: Record<string, string> = {};

  for (const scene of spec.scenes) {
    for (const fact of scene.facts) {
      if (fact.kind === 'relation' && fact.relation === 'couple') themes.add('love');
      if (fact.kind === 'mood' && fact.mood === 'jealous') themes.add('jealousy');
      if (fact.kind !== 'harm') continue;

      const optionId = choices[`${fact.id}:frame`];
      if (!optionId) continue;
      const { actor, target } = fact;
      actors.add(actor);
      const { frame, by } = parseFrame(optionId);

      switch (frame) {
        case 'deliberate':
          aggressors.add(actor);
          victims.add(target);
          themes.add('cruelty');
          break;
        case 'manipulated':
          if (by) {
            aggressors.add(by);
            actors.add(by);
            manipulatorOf[fact.id] = by;
          }
          victims.add(target);
          themes.add('betrayal');
          break;
        case 'revenge':
          // The old wrong: the target once harmed the actor on purpose. The payback itself is
          // nullified on both sides.
          aggressors.add(target);
          victims.add(actor);
          themes.add('revenge');
          break;
        case 'selfDefense':
          aggressors.add(target);
          victims.add(actor);
          themes.add('survival');
          break;
        case 'accident':
          victims.add(target);
          themes.add('tragedy');
          break;
        case 'willing':
          themes.add('despair');
          break;
      }
    }
  }

  for (const [choiceId, optionId] of Object.entries(choices)) {
    const [factId, kind, witness] = choiceId.split(':');
    if (kind !== 'react') continue;
    if (optionId === 'mourns') themes.add('grief');
    if (optionId === 'rejoices') themes.add('spite');
    // Consistency rule: whoever engineered a harm doesn't grieve its victim.
    if (optionId === 'mourns' && manipulatorOf[factId] === witness) {
      broken.push(`rule:manipulator-mourns:${witness}`);
    }
  }

  const roles: Record<string, Role[]> = {};
  for (const c of spec.characters) {
    const r: Role[] = [];
    if (victims.has(c.id)) r.push('victim');
    if (aggressors.has(c.id)) r.push('aggressor');
    if (!actors.has(c.id) && !aggressors.has(c.id) && !victims.has(c.id)) r.push('bystander');
    roles[c.id] = r;
  }

  const themeList = [...themes];
  const pointIds = new Set((points ?? choicePoints(spec)).map((p) => p.id));
  for (const c of spec.constraints) {
    if (!satisfies(c, roles, themeList, choices, pointIds)) broken.push(c.id);
  }

  return { roles, themes: themeList, broken };
}

function satisfies(
  c: Constraint,
  roles: Record<string, Role[]>,
  themes: Theme[],
  choices: Choices,
  pointIds: Set<string>,
): boolean {
  switch (c.kind) {
    case 'role': {
      const has = (roles[c.who] ?? []).includes(c.role);
      return c.mode === 'require' ? has : !has;
    }
    case 'theme': {
      const has = themes.includes(c.theme);
      return c.mode === 'require' ? has : !has;
    }
    case 'frame':
      return !Object.entries(choices).some(
        ([id, opt]) => id.endsWith(':frame') && parseFrame(opt).frame === c.frame,
      );
    case 'pin':
      // A pin on a question the spec no longer asks is stale; it doesn't block anything.
      return !pointIds.has(c.choiceId) || choices[c.choiceId] === c.optionId;
  }
}

/** Constraints (and pins) that no longer refer to anything in the spec. */
export function staleConstraints(spec: StorySpec): string[] {
  const ids = new Set(spec.characters.map((c) => c.id));
  const pointIds = new Set(choicePoints(spec).map((p) => p.id));
  return spec.constraints
    .filter((c) =>
      c.kind === 'role' ? !ids.has(c.who) : c.kind === 'pin' ? !pointIds.has(c.choiceId) : false,
    )
    .map((c) => c.id);
}
