import { describe, expect, it } from 'vitest';
import { choicePoints, specProblems } from './choices';
import { evaluate } from './evaluate';
import { toAspSpec, toMarkdown } from './export';
import { alternatives, enumerate, spin, swapChoice } from './generate';
import { BROTHERS, LIGHTHOUSE } from './samples';
import type { StorySpec } from './types';

const withConstraints = (spec: StorySpec, constraints: StorySpec['constraints']): StorySpec => ({
  ...spec,
  constraints,
});

describe('choice points', () => {
  it('asks why the harm happened, how witnesses took it, and what caused the mood', () => {
    const ids = choicePoints(BROTHERS).map((p) => p.id);
    expect(ids).toEqual(['f6:cause', 'f7:frame', 'f7:react:eliza']);
    const frame = choicePoints(BROTHERS).find((p) => p.id === 'f7:frame')!;
    expect(frame.question).toBe('Why did Parry kill Al?');
    expect(frame.options.map((o) => o.id)).toContain('manipulated:eliza');
  });

  it('does not let the dead act or pull strings', () => {
    const spec: StorySpec = {
      ...BROTHERS,
      scenes: [
        ...BROTHERS.scenes,
        {
          id: 's6',
          title: 'Aftermath',
          facts: [{ id: 'f8', kind: 'harm', actor: 'eliza', target: 'parry', act: 'attacks' }],
        },
      ],
    };
    const frame = choicePoints(spec).find((p) => p.id === 'f8:frame')!;
    expect(frame.options.map((o) => o.id)).not.toContain('manipulated:al');
    expect(choicePoints(spec).some((p) => p.id === 'f8:react:al')).toBe(false);
  });

  it('flags a dead character acting later', () => {
    const spec: StorySpec = {
      ...BROTHERS,
      scenes: [
        ...BROTHERS.scenes,
        { id: 's6', title: 'Ghost', facts: [{ id: 'f8', kind: 'introduce', who: 'al' }] },
      ],
    };
    expect(specProblems(spec)).toEqual(['"Ghost": Al already died in an earlier scene.']);
  });
});

describe('roles (after storyroles.lp)', () => {
  const base = { 'f6:cause': 'unknown', 'f7:react:eliza': 'unmoved' };

  it('a deliberate killing makes an aggressor and a victim', () => {
    const { roles } = evaluate(BROTHERS, { ...base, 'f7:frame': 'deliberate' });
    expect(roles).toEqual({ al: ['victim'], parry: ['aggressor'], eliza: ['bystander'] });
  });

  it('manipulation moves the blame to whoever pulled the strings', () => {
    const { roles } = evaluate(BROTHERS, { ...base, 'f7:frame': 'manipulated:eliza' });
    expect(roles).toEqual({ al: ['victim'], parry: [], eliza: ['aggressor'] });
  });

  it('revenge flips who was wronged', () => {
    const { roles, themes } = evaluate(BROTHERS, { ...base, 'f7:frame': 'revenge' });
    expect(roles.parry).toEqual(['victim']);
    expect(roles.al).toEqual(['aggressor']);
    expect(themes).toContain('revenge');
  });

  it('a manipulator cannot mourn their own victim', () => {
    const { broken } = evaluate(BROTHERS, {
      ...base,
      'f7:frame': 'manipulated:eliza',
      'f7:react:eliza': 'mourns',
    });
    expect(broken).toEqual(['rule:manipulator-mourns:eliza']);
  });
});

describe('spinning variations', () => {
  it("rolemodel's full spec leaves only Eliza pulling the strings", () => {
    const spec = withConstraints(BROTHERS, [
      { id: 'a', kind: 'role', who: 'eliza', role: 'aggressor', mode: 'require' },
      { id: 'b', kind: 'role', who: 'parry', role: 'aggressor', mode: 'forbid' },
      { id: 'c', kind: 'role', who: 'al', role: 'aggressor', mode: 'forbid' },
      { id: 'd', kind: 'role', who: 'eliza', role: 'victim', mode: 'forbid' },
    ]);
    const { solutions } = enumerate(spec);
    expect(solutions.length).toBeGreaterThan(0);
    for (const s of solutions) expect(s['f7:frame']).toBe('manipulated:eliza');
  });

  it('returns n different tellings, the same ones for the same seed', () => {
    const a = spin(BROTHERS, 5, 42);
    const b = spin(BROTHERS, 5, 42);
    expect(a.variations).toHaveLength(5);
    expect(new Set(a.variations.map((v) => v.id)).size).toBe(5);
    expect(a.variations.map((v) => v.id)).toEqual(b.variations.map((v) => v.id));
    // Diversity: five tellings shouldn't all share one explanation.
    expect(new Set(a.variations.map((v) => v.choices['f7:frame'])).size).toBeGreaterThan(3);
  });

  it('honors pins and banned explanations', () => {
    const spec = withConstraints(BROTHERS, [
      { id: 'p', kind: 'pin', choiceId: 'f6:cause', optionId: 'char:eliza', label: '' },
      { id: 'x', kind: 'frame', frame: 'accident', mode: 'forbid' },
    ]);
    for (const s of enumerate(spec).solutions) {
      expect(s['f6:cause']).toBe('char:eliza');
      expect(s['f7:frame']).not.toBe('accident');
    }
  });

  it('names the constraints to drop when nothing fits', () => {
    const spec = withConstraints(BROTHERS, [
      { id: 'ok', kind: 'role', who: 'al', role: 'victim', mode: 'require' },
      { id: 'clash', kind: 'role', who: 'al', role: 'victim', mode: 'forbid' },
    ]);
    const result = spin(spec, 3, 1);
    expect(result.total).toBe(0);
    expect(result.culprits.map((c) => c.id).sort()).toEqual(['clash', 'ok']);
  });
});

describe('co-creation', () => {
  it('offers alternatives for a page and keeps unrelated rewrites when swapping', () => {
    const [v] = spin(LIGHTHOUSE, 1, 7).variations;
    const theftPage = v.pages.findIndex((p) => p.title === 'The theft');
    const v2 = { ...v, overrides: { 1: 'My own opening.', [theftPage]: 'My own theft.' } };
    const alts = alternatives(v2, 'g5:frame');
    expect(alts.find((a) => a.optionId === 'deliberate')?.allowed).toBe(false); // cruelty banned
    const target = alts.find((a) => a.allowed && !a.current)!;
    const swapped = swapChoice(v2, 'g5:frame', target.optionId);
    expect(swapped.choices['g5:frame']).toBe(target.optionId);
    expect(swapped.overrides).toEqual({ 1: 'My own opening.' });
  });
  it('repairs other answers when a swap alone would break a rule', () => {
    const [v] = spin(
      withConstraints(BROTHERS, [
        { id: 'p1', kind: 'pin', choiceId: 'f7:frame', optionId: 'deliberate', label: '' },
        { id: 'p2', kind: 'pin', choiceId: 'f7:react:eliza', optionId: 'mourns', label: '' },
      ]),
      1,
      1,
    ).variations;
    const alt = alternatives(v, 'f7:frame').find((a) => a.optionId === 'manipulated:eliza')!;
    // Eliza can't grieve a death she engineered, and her grief is pinned: no telling fits.
    expect(alt.allowed).toBe(false);

    const free = { ...v, spec: withConstraints(BROTHERS, []) };
    const repaired = alternatives(free, 'f7:frame').find(
      (a) => a.optionId === 'manipulated:eliza',
    )!;
    expect(repaired.allowed).toBe(true);
    expect(repaired.alsoChanges).toEqual(['How did Eliza take it?']);
    expect(repaired.choices!['f7:react:eliza']).not.toBe('mourns');
  });
});

describe('narration and export', () => {
  it('stages the story as cover, one page per scene, and an ending', () => {
    const [v] = spin(
      withConstraints(BROTHERS, [
        { id: 'p', kind: 'pin', choiceId: 'f7:frame', optionId: 'manipulated:eliza', label: '' },
      ]),
      1,
      3,
    ).variations;
    expect(v.pages.map((p) => p.kind)).toEqual([
      'cover',
      'scene',
      'scene',
      'scene',
      'scene',
      'scene',
      'end',
    ]);
    expect(v.pages[1].text).toBe('Once upon a time, Al and Parry were brothers.');
    expect(v.pages[5].text).toContain('turning him against Al');
    expect(v.logline).toBe('Eliza turned Parry against Al.');
    expect(toMarkdown(v)).toContain('# The Brothers');
  });

  it("exports the spec in rolemodel's ASP vocabulary", () => {
    const asp = toAspSpec(BROTHERS);
    expect(asp).toContain('person(eliza).');
    expect(asp).toContain('forbidden_role(victim,eliza).');
    expect(asp).toContain('author_spec(attrib(al,rel(siblings,parry)),1).');
    expect(asp).toContain('author_spec(svo(parry,kills,al),5).');
  });
});
