import {
  Ban,
  Braces,
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Pin,
  RotateCcw,
  Shuffle,
  Star,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { choicePoints, parseFrame } from '../engine/choices';
import { toMarkdown } from '../engine/export';
import { alternatives, swapChoices } from '../engine/generate';
import type { Frame, Variation } from '../engine/types';
import { download } from '../utils/storage';
import { Illustration } from './Illustration';
import { RoleChips } from './RoleChips';

interface Props {
  variation: Variation;
  kept: boolean;
  onChange: (next: Variation) => void;
  onClose: () => void;
  onKeep: () => void;
  onPin: (choiceId: string, optionId: string, label: string) => void;
  onBan: (frame: Frame) => void;
}

export function Storybook({ variation, kept, onChange, onClose, onKeep, onPin, onBan }: Props) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [draft, setDraft] = useState<string | null>(null);
  const [showLogic, setShowLogic] = useState(false);
  const [openChoice, setOpenChoice] = useState<string | null>(null);

  const { pages, spec } = variation;
  const page = pages[index];
  const points = useMemo(() => choicePoints(spec), [spec]);
  const text = variation.overrides[index] ?? page.text;

  const go = useCallback(
    (to: number) => {
      if (to < 0 || to >= pages.length || to === index) return;
      setDirection(to > index ? 'forward' : 'backward');
      setIndex(to);
      setDraft(null);
      setOpenChoice(null);
    },
    [index, pages.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (draft !== null) return;
      if (e.key === 'ArrowRight') go(index + 1);
      if (e.key === 'ArrowLeft') go(index - 1);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draft, go, index, onClose]);

  const saveDraft = () => {
    if (draft === null) return;
    const overrides = { ...variation.overrides };
    if (draft.trim() && draft !== page.text) overrides[index] = draft;
    else delete overrides[index];
    onChange({ ...variation, overrides });
    setDraft(null);
  };

  const restore = () => {
    const overrides = { ...variation.overrides };
    delete overrides[index];
    onChange({ ...variation, overrides });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#2a211b]/90 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Storybook: ${spec.title}`}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 pb-3 text-paper">
        <div className="min-w-0">
          <p className="truncate font-story text-lg">{spec.title}</p>
          <p className="truncate text-sm text-paper/70">{variation.logline}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onKeep}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm hover:bg-white/10"
            aria-pressed={kept}
          >
            <Star size={16} className={kept ? 'fill-amber-300 text-amber-300' : ''} />
            {kept ? 'Kept' : 'Keep'}
          </button>
          <button
            onClick={() =>
              download(`${spec.title.replace(/\W+/g, '-').toLowerCase()}.md`, toMarkdown(variation))
            }
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm hover:bg-white/10"
          >
            <Download size={16} /> Markdown
          </button>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-white/10"
            aria-label="Close storybook"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="relative mx-auto flex min-h-0 w-full max-w-6xl flex-1 items-stretch">
        <button
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="absolute top-1/2 -left-1 z-10 -translate-y-1/2 rounded-full bg-paper/90 p-2 text-ink shadow disabled:opacity-0 sm:-left-5"
          aria-label="Previous page"
        >
          <ChevronLeft size={22} />
        </button>

        <div className="grid min-h-0 w-full grid-rows-[minmax(140px,38%)_1fr] overflow-hidden rounded-lg bg-paper shadow-2xl md:grid-cols-2 md:grid-rows-1">
          <div className="relative min-h-0 border-b border-paper-deep md:border-r md:border-b-0">
            <Illustration
              cast={page.cast}
              characters={spec.characters}
              icon={page.icon}
              tone={page.tone}
              label={`Illustration for ${page.title}`}
            />
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-10 bg-gradient-to-l from-black/15 to-transparent md:block" />
          </div>

          <div
            key={index}
            className={`flex min-h-0 flex-col overflow-y-auto px-6 py-6 sm:px-10 sm:py-10 ${
              direction === 'forward' ? 'turn-forward' : 'turn-backward'
            }`}
          >
            <p className="text-xs tracking-[0.2em] text-ink-soft uppercase">
              {page.kind === 'cover' ? 'StoryShop presents' : page.title}
            </p>

            {page.kind === 'cover' ? (
              <h2 className="mt-6 font-story text-4xl leading-tight sm:text-5xl">{page.title}</h2>
            ) : null}

            {draft !== null ? (
              <div className="mt-4 flex flex-col gap-2">
                <textarea
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={7}
                  className="w-full rounded-md border border-paper-deep bg-white/60 p-3 font-story text-lg leading-relaxed focus:outline-2 focus:outline-binding"
                  aria-label="Rewrite this page"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveDraft}
                    className="rounded-full bg-binding px-4 py-1.5 text-sm text-paper"
                  >
                    Save page
                  </button>
                  <button
                    onClick={() => setDraft(null)}
                    className="rounded-full px-4 py-1.5 text-sm hover:bg-paper-deep"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p
                className={`mt-4 font-story text-xl leading-relaxed sm:text-2xl ${
                  page.kind === 'scene' ? 'drop-cap' : 'italic text-ink-soft'
                }`}
              >
                {text}
              </p>
            )}

            {page.kind === 'end' ? (
              <div className="mt-6">
                <RoleChips roles={variation.roles} characters={spec.characters} />
              </div>
            ) : null}

            {variation.overrides[index] !== undefined && draft === null ? (
              <p className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
                <Pencil size={12} /> Rewritten by you
                <button onClick={restore} className="flex items-center gap-1 underline">
                  <RotateCcw size={12} /> restore the engine's text
                </button>
              </p>
            ) : null}

            <div className="mt-auto pt-8">
              {page.choiceIds.length > 0 ? (
                <div className="mb-4 space-y-2">
                  <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                    Left open by the author
                  </p>
                  {page.choiceIds.map((choiceId) => {
                    const point = points.find((p) => p.id === choiceId);
                    if (!point) return null;
                    const current = point.options.find((o) => o.id === variation.choices[choiceId]);
                    const pinned = spec.constraints.some(
                      (c) => c.kind === 'pin' && c.choiceId === choiceId,
                    );
                    const open = openChoice === choiceId;
                    return (
                      <div key={choiceId} className="rounded-md bg-paper-deep/50 p-2.5 text-sm">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-ink-soft">{point.question}</span>
                          <span className="font-medium">{current?.label}</span>
                          <span className="ml-auto flex gap-1">
                            <button
                              onClick={() => setOpenChoice(open ? null : choiceId)}
                              className="flex items-center gap-1 rounded-full px-2 py-1 hover:bg-paper-deep"
                              aria-expanded={open}
                            >
                              <Shuffle size={14} /> Try another
                            </button>
                            <button
                              onClick={() =>
                                current &&
                                onPin(choiceId, current.id, `${point.question} ${current.label}`)
                              }
                              disabled={pinned}
                              title="Keep this answer in every future spin"
                              className="flex items-center gap-1 rounded-full px-2 py-1 hover:bg-paper-deep disabled:opacity-50"
                            >
                              <Pin size={14} /> {pinned ? 'Pinned' : 'Pin'}
                            </button>
                            {point.kind === 'frame' && current ? (
                              <button
                                onClick={() => onBan(parseFrame(current.id).frame)}
                                title="Never use this kind of explanation in future spins"
                                className="flex items-center gap-1 rounded-full px-2 py-1 hover:bg-paper-deep"
                              >
                                <Ban size={14} /> Ban
                              </button>
                            ) : null}
                          </span>
                        </div>
                        {open ? (
                          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                            {alternatives(variation, choiceId).map((alt) => (
                              <li key={alt.optionId}>
                                <button
                                  disabled={!alt.allowed || alt.current}
                                  onClick={() => {
                                    if (alt.choices) onChange(swapChoices(variation, alt.choices));
                                    setOpenChoice(null);
                                  }}
                                  className={`w-full rounded px-2 py-1.5 text-left ${
                                    alt.current
                                      ? 'bg-binding text-paper'
                                      : alt.allowed
                                        ? 'bg-white/70 hover:bg-white'
                                        : 'cursor-not-allowed text-ink-soft line-through opacity-60'
                                  }`}
                                  title={
                                    !alt.allowed
                                      ? 'No telling with this answer fits your constraints'
                                      : alt.alsoChanges.length
                                        ? `To stay consistent, this also re-answers: ${alt.alsoChanges.join(' ')}`
                                        : undefined
                                  }
                                >
                                  {alt.label}
                                  {alt.allowed && !alt.current && alt.alsoChanges.length ? (
                                    <span className="block text-xs text-ink-soft">
                                      also changes {alt.alsoChanges.length} other{' '}
                                      {alt.alsoChanges.length === 1 ? 'answer' : 'answers'}
                                    </span>
                                  ) : null}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 text-sm">
                {draft === null ? (
                  <button
                    onClick={() => setDraft(text)}
                    className="flex items-center gap-1.5 rounded-full border border-paper-deep px-3 py-1.5 hover:bg-paper-deep"
                  >
                    <Pencil size={14} /> Rewrite page
                  </button>
                ) : null}
                <button
                  onClick={() => setShowLogic((s) => !s)}
                  className="flex items-center gap-1.5 rounded-full border border-paper-deep px-3 py-1.5 hover:bg-paper-deep"
                  aria-pressed={showLogic}
                >
                  <Braces size={14} /> {showLogic ? 'Hide' : 'Show'} the logic
                </button>
                <span className="ml-auto text-ink-soft">
                  {index + 1} / {pages.length}
                </span>
              </div>
              {showLogic ? (
                <pre className="mt-3 overflow-x-auto rounded-md bg-ink p-3 font-mono text-xs leading-relaxed text-paper">
                  {page.logic.join('\n') || '% nothing to show'}
                </pre>
              ) : null}
            </div>
          </div>
        </div>

        <button
          onClick={() => go(index + 1)}
          disabled={index === pages.length - 1}
          className="absolute top-1/2 -right-1 z-10 -translate-y-1/2 rounded-full bg-paper/90 p-2 text-ink shadow disabled:opacity-0 sm:-right-5"
          aria-label="Next page"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      <div className="mx-auto flex gap-1.5 pt-3" aria-label="Pages">
        {pages.map((p, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            aria-label={`Go to page ${i + 1}: ${p.title}`}
            aria-current={i === index}
            className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-paper' : 'w-2 bg-paper/40'}`}
          />
        ))}
      </div>
    </div>
  );
}
