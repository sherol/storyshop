import { BookOpen, Download, Dices, Sparkles, Star, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { RoleChips } from './components/RoleChips';
import { Storybook } from './components/Storybook';
import { Workbench } from './components/Workbench';
import { choicePoints } from './engine/choices';
import { toAspSpec } from './engine/export';
import { type SpinResult, spin } from './engine/generate';
import { BLANK, SAMPLES } from './engine/samples';
import type { Constraint, Frame, StorySpec, Variation } from './engine/types';
import { describeConstraint } from './utils/describe';
import { download, load, newId, save } from './utils/storage';

type Shelf = 'spun' | 'kept';

export default function App() {
  const [state, setState] = useState(load);
  const { spec, n, seed, spun, kept } = state;
  const [lastSpin, setLastSpin] = useState<Omit<SpinResult, 'variations'> | null>(null);
  const [open, setOpen] = useState<{ shelf: Shelf; index: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => save(state), [state]);

  const openQuestions = useMemo(() => choicePoints(spec).length, [spec]);
  const specChanged = spun.length > 0 && JSON.stringify(spun[0].spec) !== JSON.stringify(spec);

  const setSpec = (next: StorySpec) => setState((s) => ({ ...s, spec: next }));

  const doSpin = (nextSeed: number) => {
    const result = spin(spec, n, nextSeed);
    setState((s) => ({ ...s, seed: nextSeed, spun: result.variations }));
    setLastSpin({ total: result.total, truncated: result.truncated, culprits: result.culprits });
    setNotice(null);
  };

  const updateVariation = (shelf: Shelf, index: number, next: Variation) =>
    setState((s) => ({ ...s, [shelf]: s[shelf].map((v, i) => (i === index ? next : v)) }));

  const isKept = (v: Variation) => kept.some((k) => k.id === v.id);

  const toggleKeep = (v: Variation) => {
    if (isKept(v)) {
      setState((s) => ({ ...s, kept: s.kept.filter((k) => k.id !== v.id) }));
      if (open?.shelf === 'kept') setOpen(null);
    } else {
      setState((s) => ({ ...s, kept: [...s.kept, v] }));
    }
  };

  const addConstraint = (c: Constraint, message: string) => {
    setState((s) => ({ ...s, spec: { ...s.spec, constraints: [...s.spec.constraints, c] } }));
    setNotice(message);
  };

  const openVariation = open ? (open.shelf === 'spun' ? spun : kept)[open.index] : undefined;

  return (
    <div className="min-h-screen">
      <header className="border-b border-black/10 bg-paper/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <BookOpen className="text-binding" aria-hidden />
          <div className="mr-auto">
            <h1 className="font-story text-2xl leading-none font-semibold">StoryShop</h1>
            <p className="text-sm text-ink-soft">
              Set the constraints. Spin out tellings. Write the rest together.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-ink-soft">Start from</span>
            <select
              className="rounded border border-black/15 bg-white/80 px-2 py-1"
              value=""
              onChange={(e) => {
                const chosen = e.target.value === 'blank' ? BLANK : SAMPLES[Number(e.target.value)];
                if (!chosen) return;
                setState((s) => ({ ...s, spec: chosen, spun: [] }));
                setLastSpin(null);
              }}
            >
              <option value="">Choose…</option>
              {SAMPLES.map((s, i) => (
                <option key={s.title} value={i}>
                  {s.title}
                </option>
              ))}
              <option value="blank">A blank page</option>
            </select>
          </label>
          <button
            onClick={() =>
              download(`${spec.title.replace(/\W+/g, '-').toLowerCase()}.lp`, toAspSpec(spec))
            }
            className="flex items-center gap-1.5 rounded-full border border-black/15 px-3 py-1.5 text-sm hover:bg-paper-deep"
            title="Download the spec as clingo facts in rolemodel's vocabulary"
          >
            <Download size={14} /> ASP spec
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[minmax(340px,440px)_1fr]">
        <aside className="h-fit rounded-xl bg-paper p-4 shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <Workbench spec={spec} onChange={setSpec} />
        </aside>

        <section className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-paper p-4 shadow-sm">
            <label className="flex items-center gap-2 text-sm">
              Spin
              <input
                type="number"
                min={1}
                max={24}
                value={n}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    n: Math.max(1, Math.min(24, Number(e.target.value) || 1)),
                  }))
                }
                className="w-16 rounded border border-black/15 bg-white/80 px-2 py-1"
                aria-label="Number of variations"
              />
              variations
            </label>
            <button
              onClick={() => doSpin(seed)}
              className="flex items-center gap-1.5 rounded-full bg-binding px-4 py-2 text-sm font-medium text-paper hover:brightness-110"
            >
              <Sparkles size={16} /> Spin
            </button>
            <button
              onClick={() => doSpin(seed + 1)}
              className="flex items-center gap-1.5 rounded-full border border-black/15 px-3 py-2 text-sm hover:bg-paper-deep"
              title="Same constraints, a different draw"
            >
              <Dices size={16} /> New draw
            </button>
            <p className="text-sm text-ink-soft">
              {openQuestions} open {openQuestions === 1 ? 'question' : 'questions'} for the engine
              {lastSpin
                ? ` · ${lastSpin.total}${lastSpin.truncated ? '+' : ''} tellings fit your constraints`
                : ''}
            </p>
          </div>

          {notice ? (
            <p className="rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-900">{notice}</p>
          ) : null}
          {specChanged ? (
            <p className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900">
              The story has changed since these were spun. Spin again to see the new space.
            </p>
          ) : null}

          {lastSpin && lastSpin.total === 0 ? (
            <div className="rounded-xl bg-amber-100 p-4 text-sm text-amber-900">
              <p className="flex items-center gap-2 font-medium">
                <TriangleAlert size={16} /> No telling satisfies every constraint.
              </p>
              {lastSpin.culprits.length ? (
                <>
                  <p className="mt-2">Dropping any one of these would let a story through:</p>
                  <ul className="mt-1 list-disc pl-5">
                    {lastSpin.culprits.map((c) => (
                      <li key={c.id}>{describeConstraint(c, spec.characters)}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-2">More than one constraint would have to go.</p>
              )}
            </div>
          ) : null}

          <VariationGrid
            title={spun.length ? 'This spin' : ''}
            variations={spun}
            isKept={isKept}
            onOpen={(index) => setOpen({ shelf: 'spun', index })}
            onKeep={toggleKeep}
          />
          {spun.length === 0 && !lastSpin ? (
            <div className="rounded-xl border-2 border-dashed border-black/10 p-10 text-center text-ink-soft">
              <p className="font-story text-xl">Once upon a time, n times over.</p>
              <p className="mt-2 text-sm">
                Shape the cast and scenes on the left, then spin to see every way the story can go.
              </p>
            </div>
          ) : null}

          {kept.length ? (
            <VariationGrid
              title="Kept"
              variations={kept}
              isKept={() => true}
              onOpen={(index) => setOpen({ shelf: 'kept', index })}
              onKeep={toggleKeep}
            />
          ) : null}
        </section>
      </main>

      {open && openVariation ? (
        <Storybook
          variation={openVariation}
          kept={isKept(openVariation)}
          onClose={() => setOpen(null)}
          onKeep={() => toggleKeep(openVariation)}
          onChange={(next) => updateVariation(open.shelf, open.index, next)}
          onPin={(choiceId, optionId, label) => {
            const pin: Constraint = { id: newId('p'), kind: 'pin', choiceId, optionId, label };
            setState((s) => ({
              ...s,
              spec: {
                ...s.spec,
                constraints: [
                  ...s.spec.constraints.filter(
                    (c) => !(c.kind === 'pin' && c.choiceId === choiceId),
                  ),
                  pin,
                ],
              },
            }));
            updateVariation(open.shelf, open.index, {
              ...openVariation,
              spec: {
                ...openVariation.spec,
                constraints: [...openVariation.spec.constraints, pin],
              },
            });
            setNotice('Pinned. Every future spin keeps that answer.');
          }}
          onBan={(frame: Frame) => {
            if (spec.constraints.some((c) => c.kind === 'frame' && c.frame === frame)) return;
            addConstraint(
              { id: newId('c'), kind: 'frame', frame, mode: 'forbid' },
              'Banned. Spin again to see the story without that explanation.',
            );
          }}
        />
      ) : null}
    </div>
  );
}

function VariationGrid({
  title,
  variations,
  isKept,
  onOpen,
  onKeep,
}: {
  title: string;
  variations: Variation[];
  isKept: (v: Variation) => boolean;
  onOpen: (index: number) => void;
  onKeep: (v: Variation) => void;
}) {
  if (!variations.length) return null;
  return (
    <div>
      {title ? (
        <h2 className="mb-2 font-story text-lg font-semibold">
          {title} <span className="text-sm font-normal text-ink-soft">({variations.length})</span>
        </h2>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {variations.map((v, i) => {
          const edits = Object.keys(v.overrides).length;
          return (
            <li
              key={`${v.id}-${i}`}
              className="flex flex-col rounded-xl border border-black/5 bg-paper p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start gap-2">
                <span className="font-story text-3xl leading-none text-binding/40">{i + 1}</span>
                <p className="flex-1 font-story text-lg leading-snug">{v.logline}</p>
                <button
                  onClick={() => onKeep(v)}
                  className="rounded-full p-1 hover:bg-paper-deep"
                  aria-label={isKept(v) ? 'Remove from kept' : 'Keep this telling'}
                  aria-pressed={isKept(v)}
                >
                  <Star size={18} className={isKept(v) ? 'fill-amber-400 text-amber-500' : ''} />
                </button>
              </div>
              <p className="mt-2 text-xs text-ink-soft">
                {v.themes.join(' · ') || 'a quiet story'}
                {edits ? ` · ${edits} page${edits === 1 ? '' : 's'} rewritten by you` : ''}
              </p>
              <div className="mt-3">
                <RoleChips roles={v.roles} characters={v.spec.characters} />
              </div>
              <button
                onClick={() => onOpen(i)}
                className="mt-4 flex items-center justify-center gap-1.5 rounded-full border border-binding/30 py-1.5 text-sm text-binding hover:bg-binding hover:text-paper"
              >
                <BookOpen size={15} /> Read as a storybook
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
