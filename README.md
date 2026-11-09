# Storyshop

Set story constraints, spin out _n_ tellings that satisfy them, then co-write the one you like.
Each telling is staged like a picture book.

Storyshop builds on [rolemodel](https://github.com/ffpaladin/rolemodel) (the "Kaleidoscope" /
"Tell me a story" project). That project wrote story constraints in Answer Set Programming,
had clingo find answer sets, and showed each one as a comic with `impress.js`. Storyshop keeps
the idea and runs it entirely in the browser:

1. **The author fixes what visibly happens.** Characters, scenes, and the events in each scene
   (relationships, arrivals, feelings, gifts, harms) are like rolemodel's `author_spec` facts.
2. **The engine fills in what was left open.** Why each harm happened (on purpose, someone
   pulled the strings, revenge, self-defense, an accident, the target no longer cared), how
   witnesses took it, and what caused each feeling.
3. **Roles fall out of the explanations**, following rolemodel's `storyroles.lp`. A
   manipulated killer isn't the aggressor; whoever manipulated them is. Revenge flips who was
   wronged. Self-defense makes the attacker the aggressor.
4. **Constraints prune the space.** "Eliza must be the aggressor", "no revenge", "the story must
   have grief". The engine enumerates every consistent telling and shows _n_ of them, picked to
   differ from each other as much as possible. If nothing fits, it names the constraints to drop.

## Writing together

Open any telling as a storybook (← / → to turn pages, Esc to close). On each page you can:

- **Try another** answer to any question the engine answered. If that answer alone would break
  a rule, the engine re-answers the fewest other questions it has to and tells you.
- **Pin** an answer so every future spin keeps it, or **Ban** a kind of explanation.
- **Rewrite** the page in your own words. Your rewrites survive swaps on other pages.
- **Show the logic** behind the page, in rolemodel's notation.

Keep the tellings you like, export one as Markdown, or download the spec as clingo facts
(**ASP spec**) to run through rolemodel's original model.

Everything is saved in your browser's local storage.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # engine tests
npm run typecheck && npm run lint && npm run build
```

- `src/engine/`: the story model (`types.ts`), open questions (`choices.ts`), role rules
  (`evaluate.ts`), search, diverse sampling and swaps (`generate.ts`), narration (`narrate.ts`),
  exports (`export.ts`) and sample stories (`samples.ts`).
- `src/components/`: the workbench (spec editor), the storybook reader, and illustrations.

Pushes to `main` deploy to GitHub Pages.
