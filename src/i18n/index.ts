// Languages of the site: Portuguese (the default), French and English. Every visible text has a
// key; the words are in plain text files, content/texts/pt.txt, fr.txt and en.txt (one
// "key = text" per line), so they can be revised without touching the code. A text missing in
// one language falls back to Portuguese, then English.
//
// The language comes from ?lang=xx in the address, else the visitor's last choice, else
// Portuguese. Changing it reloads the page (simplest way to redraw everything).
import ptText from '../../content/texts/pt.txt?raw';
import frText from '../../content/texts/fr.txt?raw';
import enText from '../../content/texts/en.txt?raw';

/** Read a texts file: "key = text" lines; blank lines and lines starting with # are skipped. */
export function parseTexts(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

export const PT = parseTexts(ptText);
export const FR = parseTexts(frText);
export const EN = parseTexts(enText);

export type Lang = 'pt' | 'fr' | 'en';

export const LANGS: { id: Lang; label: string; name: string }[] = [
  { id: 'pt', label: 'PT', name: 'Português' },
  { id: 'fr', label: 'FR', name: 'Français' },
  { id: 'en', label: 'EN', name: 'English' },
];

const DICTS: Record<Lang, Record<string, string>> = { en: EN, pt: PT, fr: FR };
const KEY = 'fragateiro.lang';

function detect(): Lang {
  if (typeof window === 'undefined') return 'pt';
  const isLang = (v: string | null | undefined): v is Lang => v === 'pt' || v === 'fr' || v === 'en';
  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  if (isLang(fromUrl)) return fromUrl;
  try {
    const saved = localStorage.getItem(KEY);
    if (isLang(saved)) return saved;
  } catch {
    // storage blocked: Portuguese
  }
  return 'pt';
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
  const text = DICTS[lang][key] ?? PT[key] ?? EN[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}

/** Like t(), but returns undefined when no dictionary has the key. */
export function tMaybe(key: string, params: Record<string, string | number> = {}): string | undefined {
  return key in PT || key in EN || key in DICTS[current] ? t(key, params) : undefined;
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
