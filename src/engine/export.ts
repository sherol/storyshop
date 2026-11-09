import { factCast } from './choices';
import type { Fact, StorySpec, Variation } from './types';

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'someone';
}

/**
 * The spec as clingo facts in rolemodel's `storyspec.txt` vocabulary, so a story drafted
 * here can be run through the original ASP model.
 */
export function toAspSpec(spec: StorySpec): string {
  const atom = new Map(spec.characters.map((c) => [c.id, slug(c.name)]));
  const a = (id: string) => atom.get(id) ?? slug(id);
  const lines: string[] = [`% ${spec.title} - exported from StoryShop`, ''];

  for (const c of spec.characters) lines.push(`person(${a(c.id)}).`);
  lines.push('', '% ============================================', '');

  for (const c of spec.constraints) {
    if (c.kind === 'role') {
      lines.push(`${c.mode === 'require' ? 'required' : 'forbidden'}_role(${c.role},${a(c.who)}).`);
    }
    if (c.kind === 'theme') {
      lines.push(`${c.mode === 'require' ? 'required' : 'forbidden'}_story(${c.theme}).`);
    }
    if (c.kind === 'frame') lines.push(`forbidden_expectation(${c.frame}).`);
  }

  spec.scenes.forEach((scene, i) => {
    lines.push('', `%% SCENE ${i + 1} - ${scene.title}`, '');
    for (const fact of scene.facts) {
      if (factCast(fact).some((id) => !atom.has(id))) continue;
      lines.push(`author_spec(${factAtom(fact, a)},${i + 1}).`);
    }
  });

  return lines.join('\n') + '\n';
}

function factAtom(fact: Fact, a: (id: string) => string): string {
  switch (fact.kind) {
    case 'relation':
      return `attrib(${a(fact.a)},rel(${fact.relation},${a(fact.b)}))`;
    case 'introduce':
      return `svo(${a(fact.who)},introduces,${a(fact.who)})`;
    case 'mood':
      return `attrib(${a(fact.who)},${fact.mood})`;
    case 'gift':
      return `svo(${a(fact.from)},ptrans(${slug(fact.object)}),${a(fact.to)})`;
    case 'harm':
      return `svo(${a(fact.actor)},${fact.act},${a(fact.target)})`;
  }
}

/** The telling as Markdown, with the co-author's rewrites in place. */
export function toMarkdown(variation: Variation): string {
  const out: string[] = [];
  variation.pages.forEach((page, i) => {
    const text = variation.overrides[i] ?? page.text;
    if (page.kind === 'cover') out.push(`# ${page.title}`, '', `_${text}_`, '');
    else out.push(`## ${page.title}`, '', text, '');
  });
  return out.join('\n');
}
