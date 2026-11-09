// Landmarks of the Bassin d'Arcachon, built from simple shapes (no model files):
//   Phare du Cap-Ferret      the 52 m lighthouse: a white round tower with a red top
//   Jetée Thiers             Arcachon's wooden pier, with its round head
//   Jetée d'Eyrac            the pier by the Eyrac pontoons, with a T head
//   Cabanes tchanquées       the two huts on stilts off the Île aux Oiseaux (shutters red / white)
// Positions and outlines from OpenStreetMap; sizes are real, details simplified.
import { Color3, Mesh, MeshBuilder, Vector3, type Scene } from '@babylonjs/core';
import type { LandMask } from '../world/landMask';
import type { Terrain } from '../world/terrain';
import { boxes, lines, material, merged, projector, type LandmarkLabel } from './landmarks';

/** Pier decks stand this high over the water (it covers the tide). */
const DECK = 4;

export function createArcachonLandmarks(scene: Scene, mask: LandMask, terrain: Terrain | undefined, origin: { lat: number; lon: number }): LandmarkLabel[] {
  const toXY = projector(origin);
  const ground = (x: number, y: number) => (mask.isWater(x, y) ? 0 : Math.max(0, terrain?.heightAt(x, y) ?? 0));
  const labels: LandmarkLabel[] = [];
  const white = material(scene, 'arc-white', '#f1eee6');
  const red = material(scene, 'arc-red', '#b8322a', 0.5);
  const wood = material(scene, 'arc-wood', '#8a7358');
  const pile = material(scene, 'arc-pile', '#4d4033');
  const roof = material(scene, 'arc-roof', '#5a5048');
  const lantern = material(scene, 'arc-lantern', '#2f3b40', 0.2);
  lantern.emissiveColor = new Color3(0.9, 0.75, 0.35);

  // --- Phare du Cap-Ferret: 52 m, round, white with the top quarter red; a gallery, the
  // lantern and its dome; the keepers' house at its foot.
  {
    const [x, y] = toXY(44.64596, -1.24881);
    const g = ground(x, y);
    const body = MeshBuilder.CreateCylinder('ferret-white', { height: 38, diameterTop: 6.6, diameterBottom: 8, tessellation: 24 }, scene);
    body.position.set(x, g + 19, y);
    const house = MeshBuilder.CreateBox('ferret-house', { width: 14, height: 6, depth: 9 }, scene);
    house.position.set(x + 9, g + 3, y - 3);
    merged('ferret-white', [body, house], white);
    const top = MeshBuilder.CreateCylinder('ferret-red', { height: 9, diameterTop: 6.2, diameterBottom: 6.6, tessellation: 24 }, scene);
    top.position.set(x, g + 42.5, y);
    const gallery = MeshBuilder.CreateCylinder('ferret-gallery', { height: 0.8, diameter: 8.4, tessellation: 24 }, scene);
    gallery.position.set(x, g + 47.4, y);
    const dome = MeshBuilder.CreateCylinder('ferret-dome', { height: 1.8, diameterTop: 0.4, diameterBottom: 4.4, tessellation: 16 }, scene);
    dome.position.set(x, g + 51.3, y);
    merged('ferret-red', [top, gallery, dome], red);
    const glass = MeshBuilder.CreateCylinder('ferret-lantern', { height: 2.6, diameter: 3.8, tessellation: 16 }, scene);
    glass.position.set(x, g + 49.1, y);
    merged('ferret-lantern', [glass], lantern);
    labels.push({ name: 'Phare du Cap-Ferret', x, y, height: g + 75 });
  }

  /** Piles under a deck: pairs across it every few metres along a line. */
  const pilesAlong = (a: [number, number], b: [number, number], halfWidth: number, step: number) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    const out: { x: number; y: number; z: number; w: number; h: number; d: number }[] = [];
    for (let s = 0; s <= len; s += step) {
      for (const side of [-1, 1]) {
        const px = a[0] + ux * s - uy * side * halfWidth;
        const py = a[1] + uy * s + ux * side * halfWidth;
        out.push({ x: px, y: DECK / 2 - 1, z: py, w: 0.45, h: DECK + 2, d: 0.45 });
      }
    }
    return out;
  };
  /** A straight wooden deck from a to b, `width` wide, with railings and its piles. */
  const pier = (name: string, a: [number, number], b: [number, number], width: number) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const d = MeshBuilder.CreateBox(name, { width, height: 0.5, depth: len }, scene);
    d.position.set((a[0] + b[0]) / 2, DECK, (a[1] + b[1]) / 2);
    d.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    const rails: Vector3[][] = [];
    for (const side of [-1, 1]) {
      const o = (width / 2) * side;
      rails.push([new Vector3(a[0] - uy * o, DECK + 1.1, a[1] + ux * o), new Vector3(b[0] - uy * o, DECK + 1.1, b[1] + ux * o)]);
    }
    return { deck: d, piles: pilesAlong(a, b, width / 2 - 0.4, 5), rails };
  };

  // --- Jetée Thiers: a 130 m wooden pier in front of the town centre, ending in a round
  // platform, lamp posts along it.
  {
    const a = toXY(44.66377, -1.168695);
    const b = toXY(44.66472, -1.16878);
    const p = pier('thiers', a, b, 5);
    const [hx, hy] = toXY(44.66483, -1.16878);
    const head = MeshBuilder.CreateCylinder('thiers-head', { height: 0.5, diameter: 22, tessellation: 32 }, scene);
    head.position.set(hx, DECK, hy);
    merged('thiers-deck', [p.deck, head], wood);
    const headPiles: typeof p.piles = [];
    for (let k = 0; k < 16; k++) {
      const t = (k / 16) * Math.PI * 2;
      headPiles.push({ x: hx + Math.sin(t) * 10, y: DECK / 2 - 1, z: hy + Math.cos(t) * 10, w: 0.45, h: DECK + 2, d: 0.45 });
    }
    boxes(scene, 'thiers-piles', [...p.piles, ...headPiles], pile);
    const lamps: { x: number; y: number; z: number; w: number; h: number; d: number }[] = [];
    for (let k = 0; k <= 4; k++) {
      const x = a[0] + ((b[0] - a[0]) * k) / 4;
      const y = a[1] + ((b[1] - a[1]) * k) / 4;
      lamps.push({ x: x + 2.2, y: DECK + 2, z: y, w: 0.2, h: 4, d: 0.2 });
    }
    boxes(scene, 'thiers-lamps', lamps, roof);
    const ring: Vector3[] = [];
    for (let k = 0; k <= 32; k++) {
      const t = (k / 32) * Math.PI * 2;
      ring.push(new Vector3(hx + Math.sin(t) * 11, DECK + 1.1, hy + Math.cos(t) * 11));
    }
    lines(scene, 'thiers-rails', [...p.rails, ring], new Color3(0.9, 0.9, 0.88));
    labels.push({ name: 'Jetée Thiers', x: hx, y: hy, height: 22 });
  }

  // --- Jetée d'Eyrac: a narrower pier, 70 m, with a T head.
  {
    const a = toXY(44.66428, -1.163694);
    const b = toXY(44.66492, -1.163694);
    const p = pier('eyrac', a, b, 4.4);
    const t0 = toXY(44.665012, -1.16351);
    const t1 = toXY(44.665012, -1.16377);
    const head = pier('eyrac-head', t0, t1, 9);
    merged('eyrac-deck', [p.deck, head.deck], wood);
    boxes(scene, 'eyrac-piles', [...p.piles, ...head.piles], pile);
    lines(scene, 'eyrac-rails', [...p.rails, ...head.rails], new Color3(0.9, 0.9, 0.88));
    labels.push({ name: "Jetée d'Eyrac", x: b[0], y: b[1], height: 22 });
  }

  // --- Cabanes tchanquées: two wooden huts on stilts over the flats by the Île aux Oiseaux,
  // one with red shutters (n° 51), one with white (n° 53).
  {
    const huts: { lat: number; lon: number; shutters: 'red' | 'white'; rot: number }[] = [
      { lat: 44.694515, lon: -1.166197, shutters: 'red', rot: 0.35 },
      { lat: 44.694377, lon: -1.166848, shutters: 'white', rot: 0.35 },
    ];
    const hutWalls: Mesh[] = [];
    const roofs: Mesh[] = [];
    const reds: Mesh[] = [];
    const whites: Mesh[] = [];
    const stilts: { x: number; y: number; z: number; w: number; h: number; d: number }[] = [];
    const STILT = 3.5;
    for (const h of huts) {
      const [x, y] = toXY(h.lat, h.lon);
      const node = (m: Mesh, dx: number, dy: number, dz: number) => {
        // Turn the offset by the hut's rotation.
        const c = Math.cos(h.rot);
        const s = Math.sin(h.rot);
        m.position.set(x + dx * c + dz * s, dy, y - dx * s + dz * c);
        m.rotation.y = h.rot;
        return m;
      };
      const platform = node(MeshBuilder.CreateBox('tchanque-floor', { width: 9, height: 0.4, depth: 7 }, scene), 0, STILT, 0);
      const walls = node(MeshBuilder.CreateBox('tchanque-walls', { width: 7, height: 3, depth: 5 }, scene), 0, STILT + 1.7, 0.6);
      hutWalls.push(platform, walls);
      // A pitched roof: two slanted boards.
      for (const side of [-1, 1]) {
        const r = node(MeshBuilder.CreateBox('tchanque-roof', { width: 7.6, height: 0.25, depth: 3.2 }, scene), 0, STILT + 3.9, 0.6 + side * 1.35);
        r.rotation.x = side * 0.5;
        roofs.push(r);
      }
      // Shutters on the long sides.
      for (const side of [-1, 1]) {
        for (const dx of [-1.8, 1.8]) {
          const sh = node(MeshBuilder.CreateBox('tchanque-shutter', { width: 1.2, height: 1.2, depth: 0.15 }, scene), dx, STILT + 1.9, 0.6 + side * 2.55);
          (h.shutters === 'red' ? reds : whites).push(sh);
        }
      }
      for (const dx of [-4, -1.3, 1.3, 4]) {
        for (const dz of [-3, 0, 3]) {
          const c = Math.cos(h.rot);
          const s = Math.sin(h.rot);
          stilts.push({ x: x + dx * c + dz * s, y: STILT / 2 - 1, z: y - dx * s + dz * c, w: 0.3, h: STILT + 2, d: 0.3 });
        }
      }
      // A ladder of steps down to the water on the sea side.
      const ladder = node(MeshBuilder.CreateBox('tchanque-ladder', { width: 1, height: STILT, depth: 0.2 }, scene), 4.3, STILT / 2, -3.4);
      hutWalls.push(ladder);
    }
    merged('tchanque-walls', hutWalls, wood);
    merged('tchanque-roofs', roofs, roof);
    if (reds.length) merged('tchanque-red', reds, red);
    if (whites.length) merged('tchanque-white', whites, white);
    boxes(scene, 'tchanque-stilts', stilts, pile);
    const [lx, ly] = toXY(44.69443, -1.16652);
    labels.push({ name: 'Cabanes tchanquées', x: lx, y: ly, height: 20 });
  }

  return labels;
}
