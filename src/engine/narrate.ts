import { HARM_VERBS, factCast, parseFrame } from './choices';
import type {
  Character,
  ChoicePoint,
  Choices,
  Fact,
  IconKey,
  Page,
  PronounSet,
  Role,
  StorySpec,
  Theme,
  Tone,
} from './types';

const PRONOUNS: Record<PronounSet, { subj: string; obj: string; pos: string; refl: string }> = {
  he: { subj: 'he', obj: 'him', pos: 'his', refl: 'himself' },
  she: { subj: 'she', obj: 'her', pos: 'her', refl: 'herself' },
  they: { subj: 'they', obj: 'them', pos: 'their', refl: 'themselves' },
};

/** Scene openers, after rolemodel's `trans[]` in printer.js. */
const OPENERS = ['One day, ', 'Then, ', 'Before long, ', 'Soon after, ', 'It seemed that '];

interface Sentence {
  text: string;
  /** Starts with a name, so a scene opener can go in front of it. */
  plain: boolean;
  /** The character the sentence opens with, for swapping in a pronoun on repeats. */
  subject?: string;
}

const MOOD_TEXT = {
  unhappy: 'grew unhappy',
  afraid: 'was afraid',
  jealous: 'burned with jealousy',
  lonely: 'felt terribly alone',
};

const ROLE_WORDS: Record<Role, string> = {
  victim: 'the one who was wronged',
  aggressor: 'the one to blame',
  bystander: 'a witness',
};

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'someone';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function narrate(
  spec: StorySpec,
  choices: Choices,
  points: ChoicePoint[],
  roles: Record<string, Role[]>,
  themes: Theme[],
): { pages: Page[]; logline: string } {
  const byId = new Map<string, Character>(spec.characters.map((c) => [c.id, c]));
  const name = (id: string) => byId.get(id)?.name ?? 'someone';
  const p = (id: string) => PRONOUNS[byId.get(id)?.pronouns ?? 'they'];
  const atom = (id: string) => slug(name(id));

  const pages: Page[] = [];
  const firstCast = spec.scenes.flatMap((s) => s.facts.flatMap(factCast));
  const castOrder = [...new Set(firstCast)].filter((id) => byId.has(id));

  pages.push({
    kind: 'cover',
    title: spec.title || 'Untitled',
    text: castOrder.length
      ? `A story of ${listNames(castOrder.map(name))}.`
      : 'A story waiting for its characters.',
    logic: spec.characters.map((c) => `person(${atom(c.id)}).`),
    choiceIds: [],
    cast: castOrder,
    icon: 'cover',
    tone: 'dawn',
  });

  let logline = '';

  spec.scenes.forEach((scene, sceneIndex) => {
    const sentences: Sentence[] = [];
    const logic: string[] = [];
    const choiceIds: string[] = [];
    let icon: IconKey = 'introduce';
    let tone: Tone = 'calm';
    const cast = new Set<string>();

    for (const fact of scene.facts) {
      if (factCast(fact).some((id) => !byId.has(id))) continue;
      factCast(fact).forEach((id) => cast.add(id));
      const step = sceneIndex + 1;
      const out = narrateFact(fact);
      sentences.push(...out.sentences);
      logic.push(...out.logic.map((l) => `${l} @${step}`));
      choiceIds.push(...out.choiceIds);
      out.cast.forEach((id) => cast.add(id));
      // The most dramatic fact sets the picture.
      if (rank(out.icon) >= rank(icon)) {
        icon = out.icon;
        tone = out.tone;
      }
    }

    const opener =
      sceneIndex === 0
        ? 'Once upon a time, '
        : sceneIndex === spec.scenes.length - 1 && spec.scenes.length > 2
          ? 'In the end, '
          : OPENERS[(sceneIndex - 1) % OPENERS.length];
    const text = sentences
      .map((s, i) => {
        let t = s.text;
        // Like rolemodel's printer: a repeated subject becomes a pronoun. Skipped for "they",
        // whose verbs would need re-agreeing ("they was").
        const prev = sentences[i - 1];
        if (s.subject && prev?.subject === s.subject && byId.get(s.subject)?.pronouns !== 'they') {
          t = p(s.subject).subj + t.slice(name(s.subject).length);
        }
        return i === 0 && s.plain ? opener + t : capitalize(t);
      })
      .join(' ');

    pages.push({
      kind: 'scene',
      title: scene.title,
      text: text || 'Nothing happens here yet.',
      logic,
      choiceIds,
      cast: [...cast],
      icon,
      tone,
    });
  });

  // Ending: who turned out to be who, the way rolemodel's judge would weigh it.
  const verdicts = castOrder.map((id) => {
    const r = roles[id] ?? [];
    return r.length
      ? `${name(id)} was ${listNames(r.map((x) => ROLE_WORDS[x]))}.`
      : `${name(id)} was neither wronged nor to blame.`;
  });
  pages.push({
    kind: 'end',
    title: 'The End',
    text: [
      themes.length ? `This was a story of ${listNames(themes)}.` : 'A quiet story.',
      ...verdicts,
    ].join(' '),
    logic: Object.entries(roles).flatMap(([id, rs]) =>
      rs.map((r) => `has_role(${r},${atom(id)}).`),
    ),
    choiceIds: [],
    cast: castOrder,
    icon: 'end',
    tone: 'dawn',
  });

  if (!logline) logline = pages.find((pg) => pg.kind === 'scene')?.text ?? pages[0].text;
  return { pages, logline: logline.split('. ')[0].replace(/\.$/, '') + '.' };

  function narrateFact(fact: Fact): {
    sentences: Sentence[];
    logic: string[];
    choiceIds: string[];
    cast: string[];
    icon: IconKey;
    tone: Tone;
  } {
    const plain = (text: string, subject?: string): Sentence => ({ text, plain: true, subject });
    const framed = (text: string): Sentence => ({ text, plain: false });

    switch (fact.kind) {
      case 'relation': {
        const { a, b, relation } = fact;
        const pa = byId.get(a)?.pronouns;
        const pb = byId.get(b)?.pronouns;
        const kin =
          pa === 'he' && pb === 'he'
            ? 'brothers'
            : pa === 'she' && pb === 'she'
              ? 'sisters'
              : 'siblings';
        const text = {
          siblings: `${name(a)} and ${name(b)} were ${kin}.`,
          friends: `${name(a)} and ${name(b)} were the best of friends.`,
          acquaintances: `${name(a)} came to know ${name(b)}.`,
          couple: `${name(a)} and ${name(b)} fell in love.`,
          rivals: `${name(a)} and ${name(b)} were bitter rivals.`,
        }[relation];
        return {
          sentences: [plain(text, relation === 'acquaintances' ? a : undefined)],
          logic: [`attrib(${atom(a)},rel(${relation},${atom(b)})).`],
          choiceIds: [],
          cast: [],
          icon: relation,
          tone: relation === 'couple' ? 'warm' : relation === 'rivals' ? 'gloomy' : 'calm',
        };
      }
      case 'introduce':
        return {
          sentences: [plain(`${name(fact.who)} arrived, and nothing would be the same.`, fact.who)],
          logic: [`svo(${atom(fact.who)},introduces,${atom(fact.who)}).`],
          choiceIds: [],
          cast: [],
          icon: 'introduce',
          tone: 'calm',
        };
      case 'gift':
        return {
          sentences: [
            plain(
              `${name(fact.from)} gave ${name(fact.to)} ${fact.object || 'a gift'}.`,
              fact.from,
            ),
          ],
          logic: [`svo(${atom(fact.from)},ptrans(${slug(fact.object)}),${atom(fact.to)}).`],
          choiceIds: [],
          cast: [],
          icon: 'gift',
          tone: 'warm',
        };
      case 'mood': {
        const choiceId = `${fact.id}:cause`;
        const cause = choices[choiceId];
        const by = cause?.startsWith('char:') ? cause.slice(5) : undefined;
        const tail = by
          ? `, and it was all because of ${name(by)}.`
          : ', though no one could say why.';
        return {
          sentences: [plain(`${name(fact.who)} ${MOOD_TEXT[fact.mood]}${tail}`, fact.who)],
          logic: [
            `attrib(${atom(fact.who)},${fact.mood}).`,
            by ? `cause(attrib(${atom(fact.who)},${fact.mood}),${atom(by)}).` : '',
          ].filter(Boolean),
          choiceIds: points.some((pt) => pt.id === choiceId) ? [choiceId] : [],
          cast: by ? [by] : [],
          icon: 'mood',
          tone: 'gloomy',
        };
      }
      case 'harm': {
        const { actor: a, target: t, act } = fact;
        const verb = HARM_VERBS[act];
        const frameId = `${fact.id}:frame`;
        const { frame, by } = parseFrame(choices[frameId] ?? 'deliberate');
        const sentences: Sentence[] = [];
        const cast: string[] = [];
        const svo = `svo(${atom(a)},${act},${atom(t)})`;
        const logic = [`${svo}.`];

        switch (frame) {
          case 'deliberate':
            sentences.push(plain(`${name(a)} ${verb} ${name(t)}, and was glad of it.`, a));
            logic.push(`motiv(${atom(a)},intends,${svo}).`, `rejoiced(${atom(a)},${atom(t)}).`);
            break;
          case 'manipulated': {
            const m = by ?? '';
            cast.push(m);
            sentences.push(
              framed(
                `For weeks, ${name(m)} had been whispering to ${name(a)}, turning ${p(a).obj} against ${name(t)}.`,
              ),
              plain(`${name(a)} ${verb} ${name(t)}.`, a),
              framed(`Too late, ${name(a)} saw what ${name(m)} had done, and grieved.`),
            );
            logic.push(
              `svo(${atom(m)},mtrans(${svo}),${atom(a)}).`,
              `manipulated(${atom(m)},${atom(a)}).`,
              `mourned(${atom(a)},${atom(t)}).`,
            );
            break;
          }
          case 'revenge':
            sentences.push(
              framed(
                `Long ago, ${name(t)} had wronged ${name(a)}, and ${name(a)} had never forgotten.`,
              ),
              plain(`${name(a)} ${verb} ${name(t)}.`, a),
              framed(`To ${name(a)}, it was only an old debt repaid.`),
            );
            logic.push(`wants(${atom(a)},motiv(avengence,${atom(a)},${atom(t)})).`);
            break;
          case 'selfDefense':
            sentences.push(
              plain(`${name(t)} came at ${name(a)} without warning.`, t),
              framed(`Fearing for ${p(a).pos} life, ${name(a)} ${verb} ${name(t)}.`),
            );
            logic.push(`self_defended(${atom(a)},${atom(t)}).`);
            break;
          case 'accident':
            sentences.push(
              framed(`By a terrible accident, ${name(a)} ${verb} ${name(t)}.`),
              plain(`${name(a)} never forgave ${p(a).refl}.`, a),
            );
            logic.push(`accidental_tragedy(${atom(a)},${atom(t)}).`);
            break;
          case 'willing':
            sentences.push(
              plain(`${name(t)} had long since stopped caring what became of ${p(t).refl}.`, t),
              framed(`When ${name(a)} ${verb} ${name(t)}, ${name(t)} did not resist.`),
            );
            logic.push(`indifferent_tragedy(${atom(t)},${atom(a)}).`);
            break;
        }

        const ids = points.some((pt) => pt.id === frameId) ? [frameId] : [];
        for (const pt of points) {
          if (pt.factId !== fact.id || pt.kind !== 'reaction') continue;
          const witness = pt.id.split(':')[2];
          const reaction = choices[pt.id];
          if (!reaction) continue;
          ids.push(pt.id);
          cast.push(witness);
          const lost = act === 'kills' ? `grieved for ${name(t)}` : `ached for ${name(t)}`;
          sentences.push(
            plain(
              reaction === 'mourns'
                ? `${name(witness)} ${lost}.`
                : reaction === 'rejoices'
                  ? `${name(witness)} was secretly glad of it.`
                  : `${name(witness)} looked away and said nothing.`,
              witness,
            ),
          );
          logic.push(`reacts(${atom(witness)},${reaction},${atom(t)}).`);
        }

        if (!logline) {
          logline = {
            deliberate: `${name(a)} ${verb} ${name(t)} on purpose`,
            manipulated: `${name(by ?? '')} turned ${name(a)} against ${name(t)}`,
            revenge: `${name(a)} settled an old score with ${name(t)}`,
            selfDefense: `${name(a)} ${verb} ${name(t)} to survive`,
            accident: `${name(a)} ${verb} ${name(t)} by accident`,
            willing: `${name(t)} let ${name(a)} do it`,
          }[frame];
          logline = capitalize(logline);
        }

        return {
          sentences,
          logic,
          choiceIds: ids,
          cast,
          icon: act,
          tone: act === 'kills' ? 'dark' : 'gloomy',
        };
      }
    }
  }
}

const ICON_RANK: Partial<Record<IconKey, number>> = {
  introduce: 0,
  acquaintances: 1,
  friends: 1,
  siblings: 1,
  gift: 2,
  rivals: 2,
  couple: 3,
  mood: 4,
  robs: 5,
  betrays: 5,
  attacks: 6,
  kills: 7,
};

function rank(icon: IconKey): number {
  return ICON_RANK[icon] ?? 0;
}
