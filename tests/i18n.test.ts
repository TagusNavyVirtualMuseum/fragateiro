import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EN, FR, PT, parseTexts, t } from '../src/i18n';

describe('translations (content/texts/*.txt)', () => {
  for (const lang of ['pt', 'fr', 'en']) {
    it(`${lang}.txt: every line is "key = text", no key twice`, () => {
      const lines = readFileSync(`content/texts/${lang}.txt`, 'utf8').split(/\r?\n/);
      const bad = lines.map((l, i) => [i + 1, l.trim()] as const).filter(([, l]) => l && !l.startsWith('#') && !/^[^=]+=/.test(l));
      expect(bad).toEqual([]);
      const keys = lines.map((l) => l.match(/^([^#=][^=]*?) *=/)?.[1]).filter(Boolean);
      expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
    });
  }
  for (const [name, dict] of [['French', FR], ['English', EN]] as const) {
    it(`${name} has every Portuguese key, and no extra ones`, () => {
      expect(Object.keys(dict).filter((k) => !(k in PT))).toEqual([]);
      expect(Object.keys(PT).filter((k) => !(k in dict))).toEqual([]);
    });
    it(`${name} keeps the same {placeholders}`, () => {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      for (const k of Object.keys(PT)) expect([k, ph(dict[k])]).toEqual([k, ph(PT[k])]);
    });
  }
  it('reads the text format', () => {
    expect(parseTexts('# a note\n\na.b = Olá {n} = x\n  c =  d  \n')).toEqual({ 'a.b': 'Olá {n} = x', c: 'd' });
  });
  it('fills placeholders; Portuguese by default', () => {
    expect(t('goal.buoy', { n: 1, total: 3 })).toBe('Boia 1 de 3');
    expect(t('goal.buoy', { n: 1, total: 3 }, 'en')).toBe('Buoy 1 of 3');
    expect(t('no.such.key')).toBe('no.such.key');
  });
});
