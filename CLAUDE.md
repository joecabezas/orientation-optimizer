# Orientation Optimizer

An evolutionary-algorithm tool that searches over 3D rotations to find the
best orientation to 3D-print a mesh in, minimizing support material. React +
`@react-three/fiber`/three.js renders the mesh, the live population, and
fitness history in the browser while the EA runs.

A **genome** is just a quaternion (rotation). Each generation, a population of
genomes is scored by a pluggable **fitness strategy**, then bred via
selection/crossover/mutation into the next generation.

## Stack

React 18, TypeScript, Vite, Tailwind CSS v4 (utility classes inline; shared
class-string helpers in `src/ui/buttonStyles.ts`/`formStyles.ts`), three.js
via `@react-three/fiber`/`@react-three/drei`, `recharts` for the fitness
chart. State is plain `useState`/`useRef` in `App.tsx` — no
Redux/Zustand/Context. Vitest for unit tests, Playwright for e2e.

## Directory map

```
src/
  domain/           Core data types, framework-agnostic
    mesh.ts           Triangle/Mesh types + makeMesh/makeTriangle (derives
                      normal + area per triangle at construction time)
    genome.ts         Genome = { id, rotation: Quaternion }. Euler angles are
                      derived only for display, never stored.
    individual.ts     Individual = { genome, score } (lower score = better)

  ea/               The evolutionary algorithm itself
    EvolutionEngine.ts  Orchestrates the generation loop (seed -> evaluate ->
                        select/crossover/mutate -> re-evaluate). Knows nothing
                        about *how* any strategy works — pure strategy pattern.
    EAConfig.ts         EAConfig shape + 3 presets (fast/medium/best) +
                        FitnessStrategyName union
    createEngine.ts     Wires an EAConfig into a ready-to-run EvolutionEngine,
                        picking concrete strategy implementations
    directionShells.ts  Generates candidate seed rotations (axis/diagonal/edge
                        directions of a cube, plus mesh-specific top faces)
    strategies/
      FitnessStrategy.ts            Interface: score(mesh, genome) -> number,
                                    optional explain(mesh, genome) -> per-
                                    triangle contribution breakdown for the UI
      OverhangFitnessStrategy.ts    Angle-only: area-weighted overhang severity
      SupportAwareFitnessStrategy.ts  Default strategy. Extends angle severity
                                    with height-above-bed weighting and a
                                    model-on-model contact penalty (occlusion
                                    approximated via a coarse XZ heightmap)
      ProjectedAreaFitnessStrategy.ts  Minimizes total downward-facing area,
                                    no printer-specific angle threshold
      overhangSeverity.ts           Shared smoothstep severity math used by
                                    the angle-based strategies
      SeedingStrategy.ts / DirectionalShellSeeding.ts / RandomSeeding.ts
      SelectionStrategy.ts / TournamentSelection.ts
      CrossoverStrategy.ts / SlerpCrossover.ts
      MutationStrategy.ts / AxisAngleMutation.ts

  meshes/           Synthetic test geometry (no file import/STL loading yet)
    primitives.ts     Low-level triangle builders: boxTriangles, wedgeTriangles,
                      stadiumLoop + extrudeRingProfile (2D ring -> hollow
                      solid), rotateAndTranslate, pushQuad
    testMeshes.ts     TEST_MESHES registry (the mesh picker's data source) +
                      each mesh's build function: Cube, L-Bracket, Asymmetric
                      Pyramid, Tilted Slab, Angled Wedge, Letter U/N/R/D —
                      each documented with what orientation-search property it
                      exercises (oblique optimum, overhang, non-manifold seam,
                      etc.)

  ui/
    components/
      ModelViewer.tsx         The 3D canvas: rotating mesh + tweening,
                              XYZ axis gizmo (billboarded labels), print-bed
                              grid, corner Euler readout, backface-debug
                              shader toggle
      GenomeTable.tsx         Population table (quaternion/Euler/score per
                              individual), click-to-copy on quaternion/Euler
      FitnessChart.tsx        Best/average score over generations (recharts)
      ConfigPanel.tsx         EA config controls, preset picker, mesh picker,
                              run/pause/reset
      ScoreExplainerPopover.tsx  "Why is this score X" popover: summary text +
                              triggers the contribution color-ramp heatmap
      CopyableValue.tsx       Click-to-copy wrapper (used by GenomeTable +
                              the viewer's corner Euler readout)
    meshGeometry.ts   Mesh -> three.js BufferGeometry, plus per-triangle
                      vertex-color updates (straight-down highlight, and the
                      score explainer's plasma-colormap contribution ramp)
    scoreExplanation.ts  Turns a FitnessStrategy.explain() result into the
                      popover's summary text + normalized per-triangle colors
    useCopyToClipboard.ts  Small hook backing CopyableValue

App.tsx             Top-level state (EA config, running engine, selected
                     genome, score explainer open/closed) and layout
main.tsx             Vite entry point
```

## Conventions

- A fitness strategy's `score()` must stay cheap (called every genome, every
  generation) — any per-triangle breakdown needed only for the UI goes behind
  a separate opt-in `explain()` method, not `score()` itself.
- Test meshes are built from `boxTriangles`/`wedgeTriangles`/ring-extrusion
  primitives concatenated into one triangle soup — they are **not** required
  to be watertight/manifold (e.g. `L-Bracket` overlaps two boxes at a seam).
  Triangle winding still matters even so: a flipped triangle silently
  corrupts fitness scoring, since strategies read `tri.normal` directly. The
  "Show inverted normals" toggle in the viewer is the way to check this
  visually (it bypasses `meshStandardMaterial`'s backface shading
  compensation, which otherwise hides winding bugs).
- No file-based mesh import today; all meshes are procedurally generated in
  `src/meshes/`.

## Verification

- When testing a visual change, do not run the app and take a screenshot —
  the user can verify a change faster themselves. If the user asks for an
  automatic check using screenshots, that's fine, but ask first.
- `npm run test` (Vitest), `npx tsc -b`, and `npm run lint` (ESLint, flat
  config in `eslint.config.js`) are all fast and safe to run freely — all
  three should stay clean on `master`.
