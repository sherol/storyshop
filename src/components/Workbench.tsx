import { ArrowDown, ArrowUp, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { FRAME_LABELS, specProblems } from '../engine/choices';
import { staleConstraints } from '../engine/evaluate';
import type {
  Character,
  Constraint,
  Fact,
  FactKind,
  Frame,
  HarmAct,
  Mood,
  PronounSet,
  Relation,
  Role,
  Scene,
  StorySpec,
  Theme,
} from '../engine/types';
import { describeConstraint } from '../utils/describe';
import { newId } from '../utils/storage';

const RELATIONS: Relation[] = ['siblings', 'friends', 'acquaintances', 'couple', 'rivals'];
const MOODS: Mood[] = ['unhappy', 'afraid', 'jealous', 'lonely'];
const ACTS: HarmAct[] = ['kills', 'attacks', 'betrays', 'robs'];
const ROLES: Role[] = ['victim', 'aggressor', 'bystander'];
const THEMES: Theme[] = [
  'cruelty',
  'betrayal',
  'revenge',
  'survival',
  'tragedy',
  'despair',
  'grief',
  'spite',
  'love',
  'jealousy',
];
const FRAMES = Object.keys(FRAME_LABELS) as Frame[];
const PALETTE = ['#f42e76', '#2f7de1', '#3fa34d', '#e08a1e', '#7b5cd6', '#0f9b9b', '#b5502e'];

const FACT_KINDS: { kind: FactKind; label: string }[] = [
  { kind: 'relation', label: 'Relationship' },
  { kind: 'introduce', label: 'Someone arrives' },
  { kind: 'mood', label: 'A feeling' },
  { kind: 'gift', label: 'A gift' },
  { kind: 'harm', label: 'Someone is harmed' },
];

const input =
  'rounded border border-black/15 bg-white/80 px-2 py-1 text-sm focus:outline-2 focus:outline-binding';
const iconButton =
  'rounded p-1 text-ink-soft hover:bg-paper-deep hover:text-ink disabled:opacity-30';

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="font-story text-lg font-semibold">{title}</h2>
        <p className="text-xs text-ink-soft">{hint}</p>
      </div>
      {children}
    </section>
  );
}

function CharacterSelect({
  value,
  characters,
  onChange,
  label,
}: {
  value: string;
  characters: Character[];
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <select
      className={input}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
    >
      {!characters.some((c) => c.id === value) ? <option value={value}>(removed)</option> : null}
      {characters.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

function defaultFact(kind: FactKind, characters: Character[]): Fact {
  const a = characters[0]?.id ?? '';
  const b = characters[1]?.id ?? a;
  const id = newId('f');
  switch (kind) {
    case 'relation':
      return { id, kind, a, b, relation: 'friends' };
    case 'introduce':
      return { id, kind, who: a };
    case 'mood':
      return { id, kind, who: a, mood: 'unhappy' };
    case 'gift':
      return { id, kind, from: a, to: b, object: 'a gift' };
    case 'harm':
      return { id, kind, actor: a, target: b, act: 'attacks' };
  }
}

function FactRow({
  fact,
  characters,
  onChange,
}: {
  fact: Fact;
  characters: Character[];
  onChange: (f: Fact) => void;
}) {
  const sel = (key: string, value: string, label: string) => (
    <CharacterSelect
      value={value}
      characters={characters}
      label={label}
      onChange={(id) => onChange({ ...fact, [key]: id } as Fact)}
    />
  );
  const word = (text: string) => <span className="text-sm text-ink-soft">{text}</span>;

  switch (fact.kind) {
    case 'relation':
      return (
        <>
          {sel('a', fact.a, 'First character')}
          {word('&')}
          {sel('b', fact.b, 'Second character')}
          {word('are')}
          <select
            className={input}
            value={fact.relation}
            aria-label="Relationship"
            onChange={(e) => onChange({ ...fact, relation: e.target.value as Relation })}
          >
            {RELATIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </>
      );
    case 'introduce':
      return (
        <>
          {sel('who', fact.who, 'Who arrives')}
          {word('arrives')}
        </>
      );
    case 'mood':
      return (
        <>
          {sel('who', fact.who, 'Who feels it')}
          {word('feels')}
          <select
            className={input}
            value={fact.mood}
            aria-label="Feeling"
            onChange={(e) => onChange({ ...fact, mood: e.target.value as Mood })}
          >
            {MOODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </>
      );
    case 'gift':
      return (
        <>
          {sel('from', fact.from, 'Giver')}
          {word('gives')}
          {sel('to', fact.to, 'Receiver')}
          <input
            className={`${input} w-28`}
            value={fact.object}
            aria-label="Gift"
            onChange={(e) => onChange({ ...fact, object: e.target.value })}
          />
        </>
      );
    case 'harm':
      return (
        <>
          {sel('actor', fact.actor, 'Who does it')}
          <select
            className={input}
            value={fact.act}
            aria-label="What they do"
            onChange={(e) => onChange({ ...fact, act: e.target.value as HarmAct })}
          >
            {ACTS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          {sel('target', fact.target, 'To whom')}
        </>
      );
  }
}

function ConstraintAdder({
  characters,
  onAdd,
}: {
  characters: Character[];
  onAdd: (c: Constraint) => void;
}) {
  const [kind, setKind] = useState<'role' | 'theme' | 'frame'>('role');
  const [who, setWho] = useState(characters[0]?.id ?? '');
  const [mode, setMode] = useState<'require' | 'forbid'>('require');
  const [role, setRole] = useState<Role>('victim');
  const [theme, setTheme] = useState<Theme>('revenge');
  const [frame, setFrame] = useState<Frame>('accident');
  const whoId = characters.some((c) => c.id === who) ? who : (characters[0]?.id ?? '');

  const add = () => {
    const id = newId('c');
    if (kind === 'role' && whoId) onAdd({ id, kind, who: whoId, role, mode });
    if (kind === 'theme') onAdd({ id, kind, theme, mode });
    if (kind === 'frame') onAdd({ id, kind, frame, mode: 'forbid' });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-dashed border-black/20 p-2">
      <select
        className={input}
        value={kind}
        aria-label="Constraint type"
        onChange={(e) => setKind(e.target.value as typeof kind)}
      >
        <option value="role">A character…</option>
        <option value="theme">The story…</option>
        <option value="frame">Ban an explanation</option>
      </select>
      {kind === 'role' ? (
        <CharacterSelect
          value={whoId}
          characters={characters}
          onChange={setWho}
          label="Character"
        />
      ) : null}
      {kind !== 'frame' ? (
        <select
          className={input}
          value={mode}
          aria-label="Must or must not"
          onChange={(e) => setMode(e.target.value as typeof mode)}
        >
          <option value="require">{kind === 'role' ? 'must be' : 'must have'}</option>
          <option value="forbid">{kind === 'role' ? 'must never be' : 'must not have'}</option>
        </select>
      ) : null}
      {kind === 'role' ? (
        <select
          className={input}
          value={role}
          aria-label="Role"
          onChange={(e) => setRole(e.target.value as Role)}
        >
          {ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      ) : null}
      {kind === 'theme' ? (
        <select
          className={input}
          value={theme}
          aria-label="Theme"
          onChange={(e) => setTheme(e.target.value as Theme)}
        >
          {THEMES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      ) : null}
      {kind === 'frame' ? (
        <select
          className={input}
          value={frame}
          aria-label="Explanation"
          onChange={(e) => setFrame(e.target.value as Frame)}
        >
          {FRAMES.map((f) => (
            <option key={f} value={f}>
              {FRAME_LABELS[f]}
            </option>
          ))}
        </select>
      ) : null}
      <button
        onClick={add}
        className="ml-auto flex items-center gap-1 rounded-full bg-binding px-3 py-1 text-sm text-paper"
      >
        <Plus size={14} /> Add
      </button>
    </div>
  );
}

export function Workbench({
  spec,
  onChange,
}: {
  spec: StorySpec;
  onChange: (s: StorySpec) => void;
}) {
  const { characters, scenes, constraints } = spec;
  const problems = specProblems(spec);
  const stale = new Set(staleConstraints(spec));

  const setCharacter = (i: number, patch: Partial<Character>) =>
    onChange({
      ...spec,
      characters: characters.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    });

  const setScene = (i: number, patch: Partial<Scene>) =>
    onChange({ ...spec, scenes: scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  const moveScene = (i: number, by: number) => {
    const next = [...scenes];
    const [s] = next.splice(i, 1);
    next.splice(i + by, 0, s);
    onChange({ ...spec, scenes: next });
  };

  return (
    <div className="space-y-6">
      <input
        className="w-full border-b border-black/15 bg-transparent pb-1 font-story text-2xl focus:border-binding focus:outline-none"
        value={spec.title}
        onChange={(e) => onChange({ ...spec, title: e.target.value })}
        aria-label="Story title"
      />

      <Section title="Cast" hint="Who can appear in the story.">
        <ul className="space-y-1.5">
          {characters.map((c, i) => (
            <li key={c.id} className="flex items-center gap-1.5">
              <input
                type="color"
                value={c.color}
                onChange={(e) => setCharacter(i, { color: e.target.value })}
                className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
                aria-label={`${c.name}'s color`}
              />
              <input
                className={`${input} min-w-0 flex-1`}
                value={c.name}
                onChange={(e) => setCharacter(i, { name: e.target.value })}
                aria-label="Character name"
              />
              <select
                className={input}
                value={c.pronouns}
                onChange={(e) => setCharacter(i, { pronouns: e.target.value as PronounSet })}
                aria-label={`${c.name}'s pronouns`}
              >
                <option value="he">he/him</option>
                <option value="she">she/her</option>
                <option value="they">they/them</option>
              </select>
              <button
                className={iconButton}
                onClick={() =>
                  onChange({ ...spec, characters: characters.filter((x) => x.id !== c.id) })
                }
                aria-label={`Remove ${c.name}`}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
        <button
          onClick={() =>
            onChange({
              ...spec,
              characters: [
                ...characters,
                {
                  id: newId('ch'),
                  name: `Character ${characters.length + 1}`,
                  pronouns: 'they',
                  color: PALETTE[characters.length % PALETTE.length],
                },
              ],
            })
          }
          className="flex items-center gap-1 text-sm text-binding hover:underline"
        >
          <Plus size={14} /> Add character
        </button>
      </Section>

      <Section title="Scenes" hint="What visibly happens, page by page. The engine decides why.">
        <ol className="space-y-3">
          {scenes.map((scene, i) => (
            <li key={scene.id} className="rounded-lg border border-black/10 bg-white/50 p-3">
              <div className="flex items-center gap-1.5">
                <span className="font-story text-ink-soft">{i + 1}.</span>
                <input
                  className={`${input} min-w-0 flex-1 font-medium`}
                  value={scene.title}
                  onChange={(e) => setScene(i, { title: e.target.value })}
                  aria-label={`Scene ${i + 1} title`}
                />
                <button
                  className={iconButton}
                  disabled={i === 0}
                  onClick={() => moveScene(i, -1)}
                  aria-label="Move scene up"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  className={iconButton}
                  disabled={i === scenes.length - 1}
                  onClick={() => moveScene(i, 1)}
                  aria-label="Move scene down"
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  className={iconButton}
                  onClick={() =>
                    onChange({ ...spec, scenes: scenes.filter((s) => s.id !== scene.id) })
                  }
                  aria-label={`Remove scene ${scene.title}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <ul className="mt-2 space-y-1.5">
                {scene.facts.map((fact) => (
                  <li key={fact.id} className="flex flex-wrap items-center gap-1.5">
                    <FactRow
                      fact={fact}
                      characters={characters}
                      onChange={(f) =>
                        setScene(i, { facts: scene.facts.map((x) => (x.id === fact.id ? f : x)) })
                      }
                    />
                    <button
                      className={`${iconButton} ml-auto`}
                      onClick={() =>
                        setScene(i, { facts: scene.facts.filter((x) => x.id !== fact.id) })
                      }
                      aria-label="Remove this event"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
              {characters.length > 0 ? (
                <select
                  className="mt-2 rounded bg-transparent text-sm text-binding"
                  value=""
                  aria-label="Add an event to this scene"
                  onChange={(e) =>
                    setScene(i, {
                      facts: [...scene.facts, defaultFact(e.target.value as FactKind, characters)],
                    })
                  }
                >
                  <option value="">+ Add an event…</option>
                  {FACT_KINDS.map((k) => (
                    <option key={k.kind} value={k.kind}>
                      {k.label}
                    </option>
                  ))}
                </select>
              ) : null}
            </li>
          ))}
        </ol>
        <button
          onClick={() =>
            onChange({
              ...spec,
              scenes: [
                ...scenes,
                { id: newId('s'), title: `Scene ${scenes.length + 1}`, facts: [] },
              ],
            })
          }
          className="flex items-center gap-1 text-sm text-binding hover:underline"
        >
          <Plus size={14} /> Add scene
        </button>
        {problems.length ? (
          <ul className="space-y-1 rounded-md bg-amber-100 p-2 text-sm text-amber-900">
            {problems.map((p) => (
              <li key={p} className="flex gap-1.5">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" /> {p}
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section
        title="Constraints"
        hint="Rules every telling must obey. Pins and bans you set while reading land here too."
      >
        <ul className="space-y-1">
          {constraints.map((c) => (
            <li
              key={c.id}
              className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-sm ${
                stale.has(c.id) ? 'bg-stone-200 text-ink-soft line-through' : 'bg-white/60'
              }`}
              title={
                stale.has(c.id) ? 'Refers to something no longer in the story; ignored.' : undefined
              }
            >
              <span className="flex-1">{describeConstraint(c, characters)}</span>
              <button
                className={iconButton}
                onClick={() =>
                  onChange({ ...spec, constraints: constraints.filter((x) => x.id !== c.id) })
                }
                aria-label="Remove constraint"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
        <ConstraintAdder
          characters={characters}
          onAdd={(c) => onChange({ ...spec, constraints: [...constraints, c] })}
        />
      </Section>
    </div>
  );
}
