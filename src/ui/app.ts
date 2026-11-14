// The game as an app: installable (manifest and offline copy, public/manifest.webmanifest and
// public/sw.js) and full screen. Browser APIs only; nothing here is needed to play.

/** The commit and day this build was made (vite.config.ts). */
declare const __BUILD__: string;

let installPrompt: (Event & { prompt(): Promise<void> }) | null = null;
const listeners = new Set<() => void>();

/** Register the offline copy (only in a built game) and listen for the install offer. */
export function setupApp(rootPath: string): void {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // The build in the address: a new version installs a new worker with a fresh copy.
      navigator.serviceWorker.register(`${rootPath}sw.js?v=${encodeURIComponent(__BUILD__.split(' ')[0])}`, { scope: rootPath }).catch(() => {
        // not available (private window, file://): the game works without it
      });
    });
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e as typeof installPrompt;
    listeners.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    listeners.forEach((f) => f());
  });
}

/** Running as an installed app (no browser bars). */
export function isInstalled(): boolean {
  return matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** The browser offers to install the game now (Chrome, Edge, Android). */
export function canInstall(): boolean {
  return !!installPrompt;
}

/** iPhone and iPad install from the Share menu ("Add to Home Screen"). */
export function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export async function install(): Promise<void> {
  const p = installPrompt;
  installPrompt = null;
  await p?.prompt();
  listeners.forEach((f) => f());
}

export function onInstallChange(f: () => void): void {
  listeners.add(f);
}

export function canFullscreen(): boolean {
  return !!document.fullscreenEnabled;
}

export function isFullscreen(): boolean {
  return !!document.fullscreenElement;
}

export async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    // refused (not from a click, or not allowed here)
  }
}
