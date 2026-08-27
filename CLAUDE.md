# Color Link — conventions for Claude Code

- The spec is `docs/pOZle_color-link_spec_v1.0.md`. It is the source of truth. If code and spec disagree, the spec wins; if the spec is ambiguous or wrong, stop and ask rather than guess.
- Build in the phase order of spec section 17. Do not start a phase until the previous phase's definition of done is met. Report at each milestone.
- `src/engine/**` and `src/generator/**` are pure TypeScript: no DOM, no `window`, no `Math.random`, no imports from `app/`, `render/`, `input/`.
- TypeScript strict mode; no `any`; no `// @ts-ignore`.
- Tests live in `tests/` mirroring `src/`. Every rule in spec 5.2 has a named test. Run `npm test` before every commit; never commit red.
- Formatting: Prettier defaults (`.prettierrc`: `{ "singleQuote": true, "semi": true }`). Run `npm run format` before committing.
- Dependencies: only those in spec 11.4. Ask before adding anything.
- All user-facing text goes through `src/app/strings.ts`. All tunables go in `src/app/config.ts` or `src/generator/difficulty.ts`.
- Commit at the end of every phase with a message `phase N: <milestone name>`; smaller commits within a phase are welcome.
- Never bump `GENERATOR_VERSION` without adding a changelog line to the spec and telling Tob.
