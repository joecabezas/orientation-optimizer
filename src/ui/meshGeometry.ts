import { BufferGeometry, Color, Float32BufferAttribute, Quaternion, Vector3 } from 'three'
import { Mesh } from '../domain/mesh'

/** Converts our immutable Mesh (triangle soup) into a three.js BufferGeometry for rendering. */
export function meshToGeometry(mesh: Mesh): BufferGeometry {
  const positions = new Float32Array(mesh.triangles.length * 9)
  let i = 0
  for (const tri of mesh.triangles) {
    positions[i++] = tri.a.x
    positions[i++] = tri.a.y
    positions[i++] = tri.a.z
    positions[i++] = tri.b.x
    positions[i++] = tri.b.y
    positions[i++] = tri.b.z
    positions[i++] = tri.c.x
    positions[i++] = tri.c.y
    positions[i++] = tri.c.z
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  // Flat-shaded, per-triangle color for the straight-down-face highlight:
  // updated every frame from the mesh's own stored per-triangle normal
  // (not the smoothed vertex normals above, which blend across shared
  // vertices and can't tell "this exact triangle is flat-down").
  geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(mesh.triangles.length * 9), 3))
  return geometry
}

const BASE_COLOR = new Color('#4f9dde')
const STRAIGHT_DOWN_COLOR = new Color('#e5484d')

/**
 * Recomputes the geometry's per-triangle color attribute for the current
 * rotation: any triangle whose rotated normal points exactly straight down
 * (normal.y === -1, i.e. it would rest flat against the bed) is highlighted;
 * everything else keeps the base color. Called every frame so the highlight
 * tracks the mesh's live orientation, not just its rest pose.
 */
export function updateStraightDownColors(geometry: BufferGeometry, mesh: Mesh, rotation: Quaternion): void {
  const colorAttr = geometry.getAttribute('color') as InstanceType<typeof Float32BufferAttribute>
  const normal = new Vector3()
  let i = 0
  for (const tri of mesh.triangles) {
    normal.copy(tri.normal).applyQuaternion(rotation)
    const color = normal.y === -1 ? STRAIGHT_DOWN_COLOR : BASE_COLOR
    for (let v = 0; v < 3; v++) {
      colorAttr.setXYZ(i++, color.r, color.g, color.b)
    }
  }
  colorAttr.needsUpdate = true
}

// Neutral gray for triangles that made exactly zero contribution to the
// score (e.g. a steep wall, or a face resting flat against the bed) — these
// are "inert", not just "low", so they're deliberately pulled out of the
// heatmap ramp entirely rather than rendered as its coolest color. Matches
// the app's existing --color-text-muted token so it reads as muted/inert
// against both the dark canvas/surface colors and the ramp's saturated hues.
const ZERO_CONTRIBUTION_COLOR = new Color('#6b7078')

// Matplotlib's "plasma" colormap for the score explainer, sampled at its
// standard 10-stop resolution (the same sampling Plotly.js ships), used to
// color triangles by their normalized fitness contribution: dark purple/blue
// (t=0, negligible-but-nonzero contribution) through magenta and orange to
// bright yellow (t=1, the mesh's biggest contributor). Deliberately avoids
// pure black/white so the ramp stays legible against the ambient/fill/rim
// lighting in ModelViewer.
const PLASMA_STOPS: ReadonlyArray<{ t: number; color: Color }> = [
  { t: 0.0, color: new Color('#0d0887') },
  { t: 0.111, color: new Color('#46039f') },
  { t: 0.222, color: new Color('#7201a8') },
  { t: 0.333, color: new Color('#9c179e') },
  { t: 0.444, color: new Color('#bd3786') },
  { t: 0.556, color: new Color('#d8576b') },
  { t: 0.667, color: new Color('#ed7953') },
  { t: 0.778, color: new Color('#fb9f3a') },
  { t: 0.889, color: new Color('#fdca26') },
  { t: 1.0, color: new Color('#f0f921') },
]

/** Interpolates the plasma ramp at t in [0, 1], writing into (and returning) `out` to avoid allocating. */
function rampColorAt(t: number, out: Color): Color {
  const clamped = Math.min(1, Math.max(0, t))
  for (let i = 1; i < PLASMA_STOPS.length; i++) {
    const prev = PLASMA_STOPS[i - 1]
    const next = PLASMA_STOPS[i]
    if (clamped <= next.t) {
      const span = next.t - prev.t
      const localT = span > 0 ? (clamped - prev.t) / span : 0
      return out.copy(prev.color).lerp(next.color, localT)
    }
  }
  return out.copy(PLASMA_STOPS[PLASMA_STOPS.length - 1].color)
}

/**
 * Recomputes the geometry's per-triangle color attribute to visualize the
 * score explainer: triangles with exactly zero normalized contribution (no
 * effect on the score at all) are shaded neutral gray; every other triangle
 * — including small-but-nonzero contributors — is colored along the plasma
 * colormap (dark purple = least, bright yellow = the mesh's top contributor)
 * by its normalized fitness contribution. Independent of the mesh's live
 * rotation — the contributions themselves already bake in the genome being
 * explained, so (unlike updateStraightDownColors) this doesn't need to be
 * recomputed as the mesh tweens toward that genome's orientation.
 */
export function updateContributionColors(
  geometry: BufferGeometry,
  mesh: Mesh,
  normalizedContributions: readonly number[],
): void {
  const colorAttr = geometry.getAttribute('color') as InstanceType<typeof Float32BufferAttribute>
  const color = new Color()
  let i = 0
  for (let t = 0; t < mesh.triangles.length; t++) {
    const contribution = normalizedContributions[t] ?? 0
    const resolved = contribution === 0 ? color.copy(ZERO_CONTRIBUTION_COLOR) : rampColorAt(contribution, color)
    for (let v = 0; v < 3; v++) {
      colorAttr.setXYZ(i++, resolved.r, resolved.g, resolved.b)
    }
  }
  colorAttr.needsUpdate = true
}
