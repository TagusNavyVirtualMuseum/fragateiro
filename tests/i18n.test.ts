import { describe, expect, it } from 'vitest';
import { EN } from '../src/i18n/en';
import { FR } from '../src/i18n/fr';
import { PT } from '../src/i18n/pt';
import { t } from '../src/i18n';

describe('translations', () => {
  for (const [name, dict] of [['Portuguese', PT], ['French', FR]] as const) {
    it(`${name} has every English key, and no extra ones`, () => {
      expect(Object.keys(dict).filter((k) => !(k in EN))).toEqual([]);
      expect(Object.keys(EN).filter((k) => !(k in dict))).toEqual([]);
    });
    it(`${name} keeps the same {placeholders}`, () => {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      for (const k of Object.keys(EN)) expect([k, ph(dict[k])]).toEqual([k, ph(EN[k])]);
    });
  }
  it('fills placeholders and falls back to English', () => {
    expect(t('goal.buoy', { n: 1, total: 3 }, 'pt')).toBe('Boia 1 de 3');
    expect(t('no.such.key')).toBe('no.such.key');
  });
});
