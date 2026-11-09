import type { ChoiceOption, ChoicePoint, Fact, Frame, HarmAct, StorySpec } from './types';

export const FRAME_LABELS: Record<Frame, string> = {
  deliberate: 'On purpose',
  manipulated: 'Someone pulled the strings',
  revenge: 'Revenge for an old wrong',
  selfDefense: 'Self-defense',
  accident: 'An accident',
  willing: 'The target no longer cared',
};

export const HARM_VERBS: Record<HarmAct, string> = {
  kills: 'killed',
  attacks: 'attacked',
  betrays: 'betrayed',
  robs: 'robbed',
};

const HARM_INFINITIVE: Record<HarmAct, string> = {
  kills: 'kill',
  attacks: 'attack',
  betrays: 'betray',
  robs: 'rob',
};

/** Characters a fact mentions, in order. */
export function factCast(fact: Fact): string[] {
  switch (fact.kind) {
    case 'relation':
      return [fact.a, fact.b];
    case 'introduce':
    case 'mood':
      return [fact.who];
    case 'gift':
      return [fact.from, fact.to];
    case 'harm':
      return [fact.actor, fact.target];
  }
}

export interface Timeline {
  /** Characters who have appeared by the end of each scene. */
  appeared: Set<string>[];
  /** Characters still alive at the start of each scene. */
  aliveAt: Set<string>[];
  /** Scene index at which each character dies (killed in that scene). */
  diedIn: Record<string, number>;
}

export function timeline(spec: StorySpec): Timeline {
  const appeared: Set<string>[] = [];
  const aliveAt: Set<string>[] = [];
  const diedIn: Record<string, number> = {};
  const seen = new Set<string>();
  const alive = new Set(spec.characters.map((c) => c.id));
  spec.scenes.forEach((scene, i) => {
    aliveAt.push(new Set(alive));
    for (const fact of scene.facts) {
      for (const who of factCast(fact)) seen.add(who);
    }
    appeared.push(new Set(seen));
    for (const fact of scene.facts) {
      if (fact.kind === 'harm' && fact.act === 'kills' && alive.has(fact.target)) {
        alive.delete(fact.target);
        diedIn[fact.target] = i;
      }
    }
  });
  return { appeared, aliveAt, diedIn };
}

/** Problems with the surface facts themselves, independent of any telling. */
export function specProblems(spec: StorySpec): string[] {
  const problems: string[] = [];
  const names = new Map(spec.characters.map((c) => [c.id, c.name]));
  const { diedIn } = timeline(spec);
  spec.scenes.forEach((scene, i) => {
    for (const fact of scene.facts) {
      const cast = factCast(fact);
      if (cast.some((id) => !names.has(id))) {
        problems.push(`"${scene.title}" mentions a character who is no longer in the cast.`);
        continue;
      }
      if (cast.length === 2 && cast[0] === cast[1]) {
        problems.push(`"${scene.title}": ${names.get(cast[0])} can't do that to themselves.`);
      }
      for (const id of cast) {
        if (diedIn[id] !== undefined && diedIn[id] < i) {
          problems.push(`"${scene.title}": ${names.get(id)} already died in an earlier scene.`);
        }
      }
    }
  });
  return problems;
}

function nameOf(spec: StorySpec, id: string): string {
  return spec.characters.find((c) => c.id === id)?.name ?? id;
}

/**
 * The open questions in a spec. Ids are built from fact ids so a pinned answer survives edits
 * to unrelated parts of the spec.
 */
export function choicePoints(spec: StorySpec): ChoicePoint[] {
  const points: ChoicePoint[] = [];
  const { appeared, aliveAt } = timeline(spec);
  const known = new Set(spec.characters.map((c) => c.id));

  spec.scenes.forEach((scene, sceneIndex) => {
    // Someone who was killed earlier in this same scene can't act later in it.
    const present = [...appeared[sceneIndex]].filter(
      (id) => known.has(id) && aliveAt[sceneIndex].has(id),
    );

    for (const fact of scene.facts) {
      if (factCast(fact).some((id) => !known.has(id))) continue;

      if (fact.kind === 'harm') {
        const { actor, target, act } = fact;
        if (actor === target) continue;
        const options: ChoiceOption[] = [
          { id: 'deliberate', label: FRAME_LABELS.deliberate },
          ...present
            .filter((m) => m !== actor && m !== target)
            .map((m) => ({
              id: `manipulated:${m}`,
              label: `${nameOf(spec, m)} pulled the strings`,
            })),
          { id: 'revenge', label: FRAME_LABELS.revenge },
        ];
        if (act === 'kills' || act === 'attacks') {
          options.push({ id: 'selfDefense', label: FRAME_LABELS.selfDefense });
          options.push({ id: 'willing', label: FRAME_LABELS.willing });
        }
        if (act !== 'betrays') options.push({ id: 'accident', label: FRAME_LABELS.accident });

        points.push({
          id: `${fact.id}:frame`,
          sceneIndex,
          factId: fact.id,
          kind: 'frame',
          question: `Why did ${nameOf(spec, actor)} ${HARM_INFINITIVE[act]} ${nameOf(spec, target)}?`,
          options,
        });

        for (const witness of present) {
          if (witness === actor || witness === target) continue;
          points.push({
            id: `${fact.id}:react:${witness}`,
            sceneIndex,
            factId: fact.id,
            kind: 'reaction',
            question: `How did ${nameOf(spec, witness)} take it?`,
            options: [
              { id: 'mourns', label: `Grieved for ${nameOf(spec, target)}` },
              { id: 'rejoices', label: 'Was secretly glad' },
              { id: 'unmoved', label: 'Looked away' },
            ],
          });
        }
      }

      if (fact.kind === 'mood') {
        points.push({
          id: `${fact.id}:cause`,
          sceneIndex,
          factId: fact.id,
          kind: 'cause',
          question: `Why was ${nameOf(spec, fact.who)} ${fact.mood}?`,
          options: [
            ...present
              .filter((x) => x !== fact.who)
              .map((x) => ({ id: `char:${x}`, label: `Because of ${nameOf(spec, x)}` })),
            { id: 'unknown', label: 'No one could say' },
          ],
        });
      }
    }
  });

  return points;
}

/** Parses a frame option id such as `manipulated:eliza`. */
export function parseFrame(optionId: string): { frame: Frame; by?: string } {
  const [frame, by] = optionId.split(':');
  return { frame: frame as Frame, by };
}
