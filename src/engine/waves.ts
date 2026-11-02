// Visual waves. The same numbers drive the water shader (GPU) and the boat's
// bobbing (CPU), so the boat sits on the waves you see. The waves do NOT push the
// boat around: the sailing physics is flat on purpose.

export interface Wave {
  /** Direction the wave travels towards, degrees (compass). */
  dirDeg: number;
  amplitude: number; // m
  wavelength: number; // m
  phase: number;
}

export const WAVES: Wave[] = [
  { dirDeg: 200, amplitude: 0.16, wavelength: 18, phase: 0 },
  { dirDeg: 160, amplitude: 0.1, wavelength: 9, phase: 1.7 },
  { dirDeg: 240, amplitude: 0.06, wavelength: 5, phase: 4.1 },
  { dirDeg: 185, amplitude: 0.04, wavelength: 2.7, phase: 2.3 },
];

const G = 9.81;

/** Packed as [dirX, dirZ, k, omega] + [amplitude, phase] for the shader. */
export function waveUniforms(waves = WAVES): { dirK: number[]; ampPhase: number[] } {
  const dirK: number[] = [];
  const ampPhase: number[] = [];
  for (const w of waves) {
    const a = (w.dirDeg * Math.PI) / 180;
    const k = (2 * Math.PI) / w.wavelength;
    dirK.push(Math.sin(a), Math.cos(a), k, Math.sqrt(G * k));
    ampPhase.push(w.amplitude, w.phase);
  }
  return { dirK, ampPhase };
}

/** Water height at world position (x = east, z = north) and time t. */
export function waveHeight(x: number, z: number, t: number, waves = WAVES): number {
  let h = 0;
  for (const w of waves) {
    const a = (w.dirDeg * Math.PI) / 180;
    const k = (2 * Math.PI) / w.wavelength;
    h += w.amplitude * Math.sin(k * (Math.sin(a) * x + Math.cos(a) * z) - Math.sqrt(G * k) * t + w.phase);
  }
  return h;
}
