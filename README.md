# Orientation Optimizer

An evolutionary-algorithm tool for finding good 3D-print orientations for a
mesh. It searches over rotations to minimize overhangs / projected area (see
`src/ea/strategies`), rendering the mesh, the current population's genomes,
and fitness history live in the browser.

## Requirements

- Node.js 20+
- npm

## Getting started

```bash
npm install
npm run dev
```

This starts a Vite dev server (default `http://localhost:5173/`) with hot
module reloading. Open the printed URL in your browser.

Other useful scripts:

```bash
npm run build     # type-check and build for production (dist/)
npm run preview   # serve the production build locally
npm run lint      # run ESLint
```

## Running tests

Unit tests (Vitest):

```bash
npm run test        # run once
npm run test:watch  # watch mode
```

End-to-end tests (Playwright, drives a real browser against the dev server):

```bash
npm run test:e2e
```

The e2e run automatically starts the dev server on port 5173 if one isn't
already running.

## Project structure

- `src/domain` — mesh and individual (genome) data model
- `src/ea` — the evolutionary algorithm engine and pluggable strategies
  (seeding, mutation, crossover, selection, fitness)
- `src/meshes` — built-in test meshes/primitives
- `src/ui` — React components (3D model viewer, genome table, fitness chart,
  config panel)
- `e2e` — Playwright end-to-end tests

## Deployment

Pushes to `master` build the app and deploy it to GitHub Pages via
`.github/workflows/deploy.yml`. The app is served under the
`/orientation-optimizer/` base path (see `vite.config.ts`).
