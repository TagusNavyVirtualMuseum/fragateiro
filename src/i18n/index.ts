// Languages of the site: Portuguese, French and English. Every visible text has a key; the
// dictionaries (pt.ts, fr.ts, en.ts) hold the words. English is the fallback.
//
// The language comes from ?lang=xx in the address, else the visitor's last choice, else the
// browser's language. Changing it reloads the page (simplest way to redraw everything).
import { EN } from './en';
import { FR } from './fr';
import { PT } from './pt';

export type Lang = 'pt' | 'fr' | 'en';

export const LANGS: { id: Lang; label: string; name: string }[] = [
  { id: 'pt', label: 'PT', name: 'Português' },
  { id: 'fr', label: 'FR', name: 'Français' },
  { id: 'en', label: 'EN', name: 'English' },
];

const DICTS: Record<Lang, Record<string, string>> = { en: EN, pt: PT, fr: FR };
const KEY = 'fragateiro.lang';

function detect(): Lang {
  if (typeof window === 'undefined') return 'en';
  const isLang = (v: string | null | undefined): v is Lang => v === 'pt' || v === 'fr' || v === 'en';
  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  if (isLang(fromUrl)) return fromUrl;
  try {
    const saved = localStorage.getItem(KEY);
    if (isLang(saved)) return saved;
  } catch {
    // storage blocked: fall through to the browser's language
  }
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return isLang(nav) ? nav : 'en';
}

let current: Lang = detect();

export function getLang(): Lang {
  return current;
}

/** Switch language: remembered, and the page reloads in it. */
export function setLang(lang: Lang): void {
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // storage blocked: the choice lasts for this page only
  }
  const url = new URL(window.location.href);
  url.searchParams.delete('lang');
  window.location.replace(url.toString());
}

/** The text for a key in the current language, with {name} placeholders filled in. */
export function t(key: string, params: Record<string, string | number> = {}, lang: Lang = current): string {
  const text = DICTS[lang][key] ?? EN[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}

/** Like t(), but returns undefined when no dictionary has the key. */
export function tMaybe(key: string, params: Record<string, string | number> = {}): string | undefined {
  return key in EN || key in DICTS[current] ? t(key, params) : undefined;
}

/** Fill every element with data-i18n="key" (HTML allowed in the text), and set <html lang>. */
export function translatePage(root: ParentNode = document): void {
  document.documentElement.lang = current;
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) el.innerHTML = t(el.dataset.i18n!);
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-alt]')) el.setAttribute('alt', t(el.dataset.i18nAlt!));
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-title]')) el.setAttribute('title', t(el.dataset.i18nTitle!));
}

/** Small PT · FR · EN switch. */
export function languageSwitch(className = 'lang-switch'): HTMLElement {
  const box = document.createElement('div');
  box.className = className;
  for (const l of LANGS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = l.label;
    b.title = l.name;
    if (l.id === current) b.classList.add('active');
    b.onclick = () => {
      if (l.id !== current) setLang(l.id);
    };
    box.append(b);
  }
  return box;
}

export { DICTS };
