// Pillar buoys in the IALA style (region A, as on the Tagus): a round float at the waterline,
// a tower painted in the mark's colour bands, a lantern, and the topmark that tells the marks
// apart from a distance (red can = port, green cone = starboard, yellow X = special mark).
// Each buoy is one mesh with its colours painted per vertex, so many buoys stay cheap to draw.
import { Color3, Mesh, MeshBuilder, StandardMaterial, VertexBuffer, type Scene } from '@babylonjs/core';

export type Topmark = 'can' | 'cone' | 'x' | 'none';

export interface BuoyStyle {
  /** Colour bands of the tower, from the bottom. */
  bands: Color3[];
  topmark: Topmark;
  /** Colour of the topmark (defaults to the top band). */
  topColour?: Color3;
  /** Height scale (1 = a 4 m tower above the water). */
  scale?: number;
}

export const MARK_COLOURS: Record<string, Color3> = {
  red: new Color3(0.78, 0.1, 0.08),
  green: new Color3(0.05, 0.5, 0.2),
  yellow: new Color3(0.95, 0.75, 0.05),
  black: new Color3(0.08, 0.08, 0.08),
  white: new Color3(0.93, 0.93, 0.9),
};

let sharedMaterial: StandardMaterial | undefined;
function buoyMaterial(scene: Scene): StandardMaterial {
  if (sharedMaterial && sharedMaterial.getScene() === scene) return sharedMaterial;
  sharedMaterial = new StandardMaterial('buoy', scene);
  sharedMaterial.diffuseColor = Color3.White();
  sharedMaterial.specularColor = new Color3(0.25, 0.25, 0.25);
  sharedMaterial.emissiveColor = new Color3(0.18, 0.18, 0.18);
  return sharedMaterial;
}

function paint(mesh: Mesh, c: Color3): Mesh {
  const n = mesh.getTotalVertices();
  const colours = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) colours.set([c.r, c.g, c.b, 1], i * 4);
  mesh.setVerticesData(VertexBuffer.ColorKind, colours);
  return mesh;
}

/** A buoy, standing at the origin of its own frame (y = 0 is the waterline). */
export function createBuoy(scene: Scene, name: string, style: BuoyStyle): Mesh {
  const k = style.scale ?? 1;
  const parts: Mesh[] = [];
  const add = (m: Mesh, c: Color3) => parts.push(paint(m, c));
  const dark = new Color3(0.15, 0.15, 0.15);
  const bands = style.bands.length ? style.bands : [MARK_COLOURS.yellow];
  // The float: a wide drum, in the bottom colour.
  const float = MeshBuilder.CreateCylinder(`${name}-float`, { height: 1.1 * k, diameter: 2.6 * k, tessellation: 18 }, scene);
  float.position.y = 0.15 * k;
  add(float, bands[0]);
  // The tower: tapering, one section per band.
  const towerH = 2.6 * k;
  bands.forEach((c, i) => {
    const t0 = i / bands.length;
    const t1 = (i + 1) / bands.length;
    const seg = MeshBuilder.CreateCylinder(`${name}-tower-${i}`, { height: towerH / bands.length, diameterBottom: (1.3 - 0.5 * t0) * k, diameterTop: (1.3 - 0.5 * t1) * k, tessellation: 14 }, scene);
    seg.position.y = 0.7 * k + towerH * (t0 + t1) * 0.5;
    add(seg, c);
  });
  const top = 0.7 * k + towerH;
  // Platform, lantern and its cap.
  const deck = MeshBuilder.CreateCylinder(`${name}-deck`, { height: 0.12 * k, diameter: 1.1 * k, tessellation: 14 }, scene);
  deck.position.y = top + 0.06 * k;
  add(deck, dark);
  const lantern = MeshBuilder.CreateCylinder(`${name}-lantern`, { height: 0.45 * k, diameter: 0.32 * k, tessellation: 10 }, scene);
  lantern.position.y = top + 0.35 * k;
  add(lantern, new Color3(0.95, 0.9, 0.7));
  const mast = MeshBuilder.CreateCylinder(`${name}-mast`, { height: 0.5 * k, diameter: 0.08 * k, tessellation: 6 }, scene);
  mast.position.y = top + 0.8 * k;
  add(mast, dark);
  // Topmark.
  const tc = style.topColour ?? bands[bands.length - 1];
  const ty = top + 1.25 * k;
  if (style.topmark === 'can') {
    const can = MeshBuilder.CreateCylinder(`${name}-can`, { height: 0.6 * k, diameter: 0.5 * k, tessellation: 12 }, scene);
    can.position.y = ty;
    add(can, tc);
  } else if (style.topmark === 'cone') {
    const cone = MeshBuilder.CreateCylinder(`${name}-cone`, { height: 0.65 * k, diameterTop: 0, diameterBottom: 0.6 * k, tessellation: 12 }, scene);
    cone.position.y = ty;
    add(cone, tc);
  } else if (style.topmark === 'x') {
    // A St Andrew's cross, built in two planes so it reads from every side.
    for (const yaw of [0, Math.PI / 2]) {
      for (const tilt of [Math.PI / 4, -Math.PI / 4]) {
        const bar = MeshBuilder.CreateBox(`${name}-x`, { width: 0.75 * k, height: 0.12 * k, depth: 0.06 * k }, scene);
        bar.rotation.set(0, yaw, tilt);
        bar.position.y = ty;
        bar.bakeCurrentTransformIntoVertices();
        add(bar, tc);
      }
    }
  }
  const buoy = Mesh.MergeMeshes(parts, true, true)!;
  buoy.name = name;
  buoy.useVertexColors = true;
  buoy.material = buoyMaterial(scene);
  buoy.isPickable = false;
  return buoy;
}

/** The style for an OpenSeaMap mark (type, colour list "red;white", category). */
export function seaMarkStyle(type: string, colour: string, category: string): BuoyStyle {
  const cols = colour
    .split(';')
    .map((c) => MARK_COLOURS[c.trim()])
    .filter((c): c is Color3 => !!c);
  const first = colour.split(';')[0]?.trim();
  let topmark: Topmark = 'none';
  if (category.includes('port') || first === 'red') topmark = 'can';
  else if (category.includes('starboard') || first === 'green') topmark = 'cone';
  else if (type.includes('special') || first === 'yellow') topmark = 'x';
  return { bands: cols.length ? cols : [MARK_COLOURS.yellow], topmark };
}

export const SPECIAL_MARK: BuoyStyle = { bands: [MARK_COLOURS.yellow], topmark: 'x', scale: 1.3 };

