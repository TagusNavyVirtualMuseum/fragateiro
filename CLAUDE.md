# Notes for AI assistants and contributors

- `src/physics/` must stay free of Babylon.js and browser APIs (a test checks this).
- Boat numbers live only in `src/physics/boats/*.ts`; model wiring only in `src/engine/boatVisuals.ts`.
- Before pushing: `npm test`, `npm run typecheck`, `npm run build`.
- After changing physics numbers, run `npm run polar` and update the figures in `docs/PHYSICS.md`.
- `.npmrc` sets `legacy-peer-deps` because npm 10 crashes on vitest's optional peers.
- In the browser console, `game.sim` is the running simulator (debug handle in `games/sailing/main.ts`).
- After changing a boat model or its wiring, rebuild the light copies used by the other boats: `npx tsx --import ./scripts/url-stub.mjs scripts/lite-models.ts` (see `docs/MODELS.md`).
