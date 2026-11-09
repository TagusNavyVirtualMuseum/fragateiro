import { describe, expect, it } from 'vitest';
import { speciesAt } from '../src/engine/wildlife';

// World metres east / north of the map origin (mid-river off Lisbon).
const xy = (lat: number, lon: number) => [(lon + 9.1) * 111320 * Math.cos((38.685 * Math.PI) / 180), (lat - 38.685) * 110574] as const;

describe('where the animals live', () => {
  it('dolphins in the estuary up to Lisbon, not further up the river', () => {
    expect(speciesAt(...xy(38.69, -9.2))).toEqual(['dolphin']); // off Belém
    expect(speciesAt(...xy(38.7, -9.0))).toEqual([]); // off Montijo
    expect(speciesAt(...xy(38.9, -9.02))).toEqual([]); // off Alhandra
  });

  it('orcas only on the open Atlantic', () => {
    expect(speciesAt(...xy(38.68, -9.42))).toContain('orca'); // off Cascais
    expect(speciesAt(...xy(38.42, -9.25))).toContain('orca'); // off Cabo Espichel
    expect(speciesAt(...xy(38.69, -9.2))).not.toContain('orca');
  });
});
