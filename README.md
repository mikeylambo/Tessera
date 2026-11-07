# TESSERA

A grid-tactics survival puzzle game where you mark and detonate rolling monoliths, and every kill becomes the ground you stand on.

- Source of truth: [`docs/GDD.md`](docs/GDD.md) · Builder law: [`CLAUDE.md`](CLAUDE.md) · [`DECISIONS.md`](DECISIONS.md) · [`TUNING_LOG.md`](TUNING_LOG.md)
- Stack: TypeScript (strict) + Three.js on `@slu/web-shell` (generated with `create-slu-game.mjs --id tessera --renderer three --frames puzzle`; shell vendored under `vendor/slu-web-shell`).

```bash
npm install
npm run dev      # http://localhost:5173
npm run gates    # typecheck + lint + unit + invariants + build + headless boot + E2E smoke
```

URL flags: `?stage=N` `?sector=N` `?seed=N` `?quick` `?daily=YYYY-MM-DD` `?playtest` `?headless` `?dev=1`.
Dev hook: `window.__GAME` (see `src/dev/gameApi.ts`).
