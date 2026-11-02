// Keyboard state plus "hold" buttons for touch screens.

export class Input {
  private readonly down = new Set<string>();
  private readonly virtual = new Set<string>();
  private readonly handlers = new Map<string, () => void>();

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      if (isTyping(e)) return;
      if (!this.down.has(e.code)) this.handlers.get(e.code)?.();
      this.down.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    target.addEventListener('blur', () => this.down.clear());
  }

  /** Is any of these keys (KeyboardEvent.code) held? */
  held(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c) || this.virtual.has(c));
  }

  /** Run `fn` once each time the key is pressed. */
  onPress(code: string, fn: () => void): void {
    this.handlers.set(code, fn);
  }

  /** Make an on-screen button behave like holding a key. */
  bindHoldButton(el: HTMLElement, code: string): void {
    const press = (e: Event) => {
      e.preventDefault();
      this.virtual.add(code);
    };
    const release = () => this.virtual.delete(code);
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointerleave', release);
    el.addEventListener('pointercancel', release);
  }
}

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && (t as HTMLInputElement).type !== 'range';
}
