import { Color3, Effect, MeshBuilder, Scene, ShaderMaterial, StandardMaterial, Vector2, Vector3, Vector4, type Mesh } from '@babylonjs/core';
import { WAVES, waveUniforms } from './waves';

const N = WAVES.length;

Effect.ShadersStore.waterVertexShader = /* glsl */ `
precision highp float;
attribute vec3 position;
uniform mat4 world;
uniform mat4 viewProjection;
uniform float time;
uniform float waveScale;
uniform vec4 dirK[${N}];
uniform vec2 ampPhase[${N}];
varying vec3 vWorld;
varying vec3 vNormal;

void main() {
  vec4 wp = world * vec4(position, 1.0);
  float h = 0.0;
  vec2 grad = vec2(0.0);
  for (int i = 0; i < ${N}; i++) {
    vec2 d = dirK[i].xy;
    float k = dirK[i].z;
    float w = dirK[i].w;
    float a = ampPhase[i].x * waveScale;
    float th = k * dot(d, wp.xz) - w * time + ampPhase[i].y;
    h += a * sin(th);
    grad += a * k * cos(th) * d;
  }
  wp.y += h;
  vWorld = wp.xyz;
  vNormal = normalize(vec3(-grad.x, 1.0, -grad.y));
  gl_Position = viewProjection * wp;
}
`;

Effect.ShadersStore.waterFragmentShader = /* glsl */ `
precision highp float;
uniform vec3 cameraPosition;
uniform vec3 sunDirection;
uniform vec3 deepColor;
uniform vec3 shallowColor;
uniform vec3 skyColor;
uniform float fogDensity;
uniform float time;
// The boat's hull at the waterline (no water is drawn inside it, so open holds stay dry):
// position (world x, z) and heading (sin, cos); half-widths in HULL_BINS slices along the
// hull, starting hullRange.x metres forward of the position, hullRange.y metres apart.
#define HULL_BINS 24
uniform vec4 hull;
uniform vec2 hullRange;
uniform float hullWidth[HULL_BINS];
// Half-widths higher up the hull (hullLevels.y above the waterline): where the water is
// higher (a wave crest), use the width at that height, so flared sides stay dry inside.
uniform float hullWidthHigh[HULL_BINS];
// hullLevels: low level, high level, boat height in the world
uniform vec3 hullLevels;
// Far sheet only: leave out the square covered by the detailed patch (it would show through).
// inner: centre x, centre z, distance from the centre to the edge (0 = off)
uniform vec3 inner;
varying vec3 vWorld;
varying vec3 vNormal;

void main() {
  if (inner.z > 0.0 && abs(vWorld.x - inner.x) < inner.z && abs(vWorld.z - inner.y) < inner.z) discard;
  vec2 d = vWorld.xz - hull.xy;
  float fwd = d.x * hull.z + d.y * hull.w;
  float side = abs(d.x * hull.w - d.y * hull.z);
  float f = (fwd - hullRange.x) / hullRange.y;
  if (hullRange.y > 0.0 && f >= 0.0 && f < float(HULL_BINS)) {
    int bin = int(f);
    float w = 0.0;
    float wh = 0.0;
    for (int i = 0; i < HULL_BINS; i++) if (i == bin) { w = hullWidth[i]; wh = hullWidthHigh[i]; }
    float t = clamp((vWorld.y - hullLevels.z - hullLevels.x) / (hullLevels.y - hullLevels.x), 0.0, 1.0);
    if (side < mix(w, wh, t)) discard;
  }
  // Small ripples on top of the big waves, fading out in the distance to avoid shimmer.
  float dist = length(cameraPosition - vWorld);
  float near = exp(-dist / 120.0);
  vec3 big = normalize(mix(vec3(0.0, 1.0, 0.0), vNormal, 0.35 + 0.65 * near));
  vec3 n = normalize(big + near * vec3(
    0.02 * sin(vWorld.x * 1.7 + vWorld.z * 0.6 + time * 1.3) + 0.015 * sin(vWorld.z * 2.9 - vWorld.x * 1.1 - time * 1.1),
    0.0,
    0.02 * cos(vWorld.z * 1.9 - vWorld.x * 0.7 + time * 1.2) + 0.015 * cos(vWorld.x * 3.1 + vWorld.z * 1.3 - time * 0.9)));
  vec3 v = normalize(cameraPosition - vWorld);
  float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  vec3 water = mix(deepColor, shallowColor, clamp(n.y * 0.5 - 0.2 + (vWorld.y + 0.3) * 0.6, 0.0, 1.0));
  vec3 color = mix(water, skyColor, fresnel);
  vec3 r = reflect(-sunDirection, n);
  color += vec3(1.0, 0.95, 0.85) * pow(max(dot(r, v), 0.0), 180.0) * 1.5;
  float fog = 1.0 - exp(-pow(dist * fogDensity, 2.0));
  // Slightly see-through close by (the net and the hull show under the surface), opaque
  // at grazing angles and in the distance.
  float alpha = mix(0.72, 1.0, clamp(max(fresnel * 1.6, fog), 0.0, 1.0));
  gl_FragColor = vec4(mix(color, skyColor, fog), alpha);
}
`;

export const HULL_BINS = 24;

/** Shape of a hull at the waterline, in the boat frame. */
export interface HullProfile {
  /** Forward position of the first slice, m. */
  fwdStart: number;
  /** Length of each slice, m. */
  step: number;
  /** Half-width of the hull in each slice (HULL_BINS values) at `levels[0]`, m. */
  halfWidths: number[];
  /** The same, at `levels[1]` (higher up the side). */
  halfWidthsHigh: number[];
  /** Heights of the two measurements above the waterline, m. */
  levels: [number, number];
}

export interface HullOutline extends HullProfile {
  /** Boat position, world metres (east, north), and heading. */
  x: number;
  y: number;
  heading: number;
  /** Height of the boat's waterline in the world (heave), m. */
  heave: number;
}

export interface Water {
  mesh: Mesh;
  /** Keep the water out of this boat's hull (or nothing, if null). */
  setHull(h: HullOutline | null): void;
  /** Keep the water patch centred on the camera target. */
  update(time: number, centre: Vector3, cameraPosition: Vector3): void;
}

export function createWater(scene: Scene, skyColor: Color3, sunDirection: Vector3, fogDensity: number): Water {
  const size = 1600;
  const mesh = MeshBuilder.CreateGround('water', { width: size, height: size, subdivisions: 240 }, scene);
  const mat = new ShaderMaterial('waterMat', scene, { vertex: 'water', fragment: 'water' }, {
    attributes: ['position'],
    uniforms: ['world', 'viewProjection', 'time', 'waveScale', 'dirK', 'ampPhase', 'cameraPosition', 'sunDirection', 'deepColor', 'shallowColor', 'skyColor', 'fogDensity', 'hull', 'hullRange', 'hullWidth', 'hullWidthHigh', 'hullLevels', 'inner'],
  });
  mat.setFloat('waveScale', 1);
  const { dirK, ampPhase } = waveUniforms();
  mat.setArray4('dirK', dirK);
  mat.setArray2('ampPhase', ampPhase);
  mat.setColor3('deepColor', new Color3(0.05, 0.2, 0.26));
  mat.setColor3('shallowColor', new Color3(0.16, 0.38, 0.4));
  mat.setColor3('skyColor', skyColor);
  mat.setVector3('sunDirection', sunDirection.normalizeToNew());
  mat.setFloat('fogDensity', fogDensity);
  mat.backFaceCulling = false;
  mat.needAlphaBlending = () => true;
  mesh.material = mat;
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;

  // Beyond the detailed patch: a big flat sheet just below the wave troughs.
  const far = MeshBuilder.CreateGround('waterFar', { width: 60000, height: 60000, subdivisions: 1 }, scene);
  const farMat = mat.clone('waterFarMat');
  farMat.setFloat('waveScale', 0);
  far.material = farMat;
  far.position.y = -0.45;
  far.isPickable = false;
  far.alwaysSelectAsActiveMesh = true;

  // A dark river bed a few metres down: seen through the translucent water, like murky depth.
  const bed = MeshBuilder.CreateGround('riverBed', { width: 4000, height: 4000, subdivisions: 1 }, scene);
  const bedMat = new StandardMaterial('riverBedMat', scene);
  bedMat.diffuseColor = new Color3(0.05, 0.13, 0.14);
  bedMat.specularColor = Color3.Black();
  bedMat.emissiveColor = new Color3(0.03, 0.08, 0.09);
  bed.material = bedMat;
  bed.position.y = -5;
  bed.isPickable = false;

  const step = size / 240;
  for (const m of [mat, farMat]) {
    m.setVector2('hullRange', new Vector2(0, 0));
    m.setFloats('hullWidth', new Array(HULL_BINS).fill(0));
    m.setFloats('hullWidthHigh', new Array(HULL_BINS).fill(0));
    m.setVector3('hullLevels', new Vector3(0, 1, 0));
    m.setVector3('inner', Vector3.Zero());
  }
  return {
    mesh,
    setHull(h) {
      for (const m of [mat, farMat]) {
        if (!h) {
          m.setVector2('hullRange', new Vector2(0, 0));
          continue;
        }
        m.setVector4('hull', new Vector4(h.x, h.y, Math.sin(h.heading), Math.cos(h.heading)));
        m.setVector2('hullRange', new Vector2(h.fwdStart, h.step));
        m.setFloats('hullWidth', h.halfWidths);
        m.setFloats('hullWidthHigh', h.halfWidthsHigh);
        m.setVector3('hullLevels', new Vector3(h.levels[0], h.levels[1], h.heave));
      }
    },
    update(time, centre, cameraPosition) {
      bed.position.x = centre.x;
      bed.position.z = centre.z;
      far.position.x = centre.x;
      far.position.z = centre.z;
      farMat.setVector3('inner', new Vector3(mesh.position.x, mesh.position.z, size / 2 - step));
      farMat.setFloat('time', time);
      farMat.setVector3('cameraPosition', cameraPosition);
      // Snap to the grid so the vertices don't "swim" as the patch follows the boat.
      mesh.position.x = Math.round(centre.x / step) * step;
      mesh.position.z = Math.round(centre.z / step) * step;
      mat.setFloat('time', time);
      mat.setVector3('cameraPosition', cameraPosition);
    },
  };
}
