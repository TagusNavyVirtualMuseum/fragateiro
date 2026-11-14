// The narrator: plays the lines of a mini-game's line bank (content/narrative/from-tool/lines,
// written by the narrative tool) at the moments the game reports. Plain TypeScript, no 3D.
// The rules are those of content/narrative/README.md:
// - a line plays when its trigger happens: a moment id (from-game/moments.json) or
//   near_place:<name>; lines with `when` only for those boats, areas or places;
// - only approved lines, unless in playtest mode (then also verified ones);
// - delivery: `cue` may play during a manoeuvre, `story` only when sailing is calm, `reflection`
//   right after a manoeuvre, `leg` one at a time from a pool on long steady legs, `curiosity`
//   goes to the logbook shown at the end of the mission;
// - a cue that asks for an action lists the moments that show it was done (`expects`); if one
//   comes within `within` seconds (15), a short `ack` line of the same speaker answers ("Isso!");
//   if not, nothing more is said;
// - quiet moments: after a random 10–20 s of calm without a caption, the story continues (the
//   next `leg` line) or, when it has nothing left, a `trivia` line (boats, region, fish, jobs).
// Lines of the same group (the `b1` in `fishing.b1.l2`) are alternatives: one of them plays.

export type Delivery = 'cue' | 'story' | 'reflection' | 'leg' | 'curiosity' | 'ack' | 'trivia';

export interface NarrativeLine {
  id: string;
  beat?: string;
  trigger: string;
  delivery: Delivery;
  speaker: string;
  when?: { boats?: string[]; areas?: string[]; places?: string[] };
  text: Record<string, string>;
  status: 'verified' | 'approved';
  /** For a cue that asks for an action: the moments that show it was done. */
  expects?: string[];
  /** Seconds to wait for an expected moment (default ACK_WINDOW). */
  within?: number;
  /** For trivia: boat, place, fish, work, people. */
  topic?: string;
  fictional?: boolean;
  sources?: string[];
}

export interface LineBank {
  version: number;
  minigame: string;
  title?: string;
  languages: string[];
  cast: { id: string; name: Record<string, string>; fictional?: boolean }[];
  lines: NarrativeLine[];
  credits?: { id: string; title: string; licence?: string }[];
}

export interface NarratorOptions {
  lang: string;
  /** Also play lines not yet approved by the author (status "verified"). */
  playtest: boolean;
  boat: string;
  area: string;
  /** The mission's ports and places (for lines limited to some places). */
  places: string[];
  random?: () => number;
  /** Seconds of calm without a caption before the story continues: random in [min, max]. */
  idle?: [number, number];
}

export interface Caption {
  id: string;
  speaker: string;
  text: string;
  delivery: Delivery;
}

/** How long a cue, a reflection or a story waits to be shown before it is dropped, s. */
const EXPIRES: Record<Delivery, number> = { cue: 4, reflection: 8, story: 90, leg: 30, curiosity: 0, ack: 6, trivia: 0 };
/** Seconds to wait for the action a cue asked for. */
export const ACK_WINDOW = 15;
/** Seconds of calm without a caption before the story continues (random in this range). */
export const IDLE: [number, number] = [10, 20];
/** At least this long between two lines from the pool for long legs, s. */
export const LEG_GAP = 40;
/** A short pause between two captions, s. */
const PAUSE = 1;

/** Seconds a caption stays on screen: time to read it, within limits. */
export function readingTime(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.min(16, Math.max(4, 2.5 + words * 0.33));
}

const groupOf = (id: string) => id.split('.').slice(0, -1).join('.') || id;

export class Narrator {
  private readonly lines: NarrativeLine[];
  private readonly used = new Set<string>();
  private readonly usedGroups = new Set<string>();
  private readonly queue: { line: NarrativeLine; until: number }[] = [];
  private current: { caption: Caption; until: number } | null = null;
  private nextFree = 0;
  private lastLeg = -Infinity;
  private readonly heard: Caption[] = [];
  private readonly random: () => number;
  private expecting: { moments: Set<string>; until: number; speaker: string } | null = null;
  private lastAck = '';
  private quietSince = 0;
  private idleNeed: number;
  private readonly trivia: NarrativeLine[];

  constructor(
    readonly bank: LineBank,
    private readonly opts: NarratorOptions,
  ) {
    this.random = opts.random ?? Math.random;
    this.lines = bank.lines.filter((l) => this.playable(l));
    // Trivia in a shuffled order, each line once.
    const t = this.lines.filter((l) => l.delivery === 'trivia');
    for (let i = t.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [t[i], t[j]] = [t[j], t[i]];
    }
    this.trivia = t;
    this.idleNeed = this.drawIdle();
  }

  private drawIdle(): number {
    const [a, b] = this.opts.idle ?? IDLE;
    return a + this.random() * (b - a);
  }

  private playable(l: NarrativeLine): boolean {
    if (l.status !== 'approved' && !(this.opts.playtest && l.status === 'verified')) return false;
    const w = l.when;
    if (!w) return true;
    if (w.boats && !w.boats.includes(this.opts.boat)) return false;
    if (w.areas && !w.areas.includes(this.opts.area)) return false;
    if (w.places && !w.places.some((p) => this.opts.places.includes(p))) return false;
    return true;
  }

  /** Lines this mission can play. */
  get count(): number {
    return this.lines.length;
  }

  /** The places whose name is a trigger (near_place:<name>), for the game to watch. */
  get placesToWatch(): string[] {
    return [...new Set(this.lines.filter((l) => l.trigger.startsWith('near_place:')).map((l) => l.trigger.slice('near_place:'.length)))];
  }

  private text(l: NarrativeLine): string {
    return l.text[this.opts.lang] ?? l.text.pt ?? Object.values(l.text)[0] ?? '';
  }

  private speaker(l: NarrativeLine): string {
    const c = this.bank.cast.find((x) => x.id === l.speaker);
    return c ? (c.name[this.opts.lang] ?? c.name.pt ?? Object.values(c.name)[0] ?? '') : '';
  }

  private caption(l: NarrativeLine): Caption {
    return { id: l.id, speaker: this.speaker(l), text: this.text(l), delivery: l.delivery };
  }

  /** The game reports a moment (now: real seconds). */
  report(moment: string, now: number): void {
    // The player did what the last cue asked: a short reply, before anything else.
    if (this.expecting && now > this.expecting.until) this.expecting = null;
    if (this.expecting?.moments.has(moment)) {
      const ack = this.pickAck(this.expecting.speaker);
      this.expecting = null;
      if (ack) this.queue.unshift({ line: ack, until: now + EXPIRES.ack });
    }
    // (Lines for long legs are a pool played in turn, not alternatives.)
    const fresh = this.lines.filter(
      (l) => l.trigger === moment && l.delivery !== 'ack' && l.delivery !== 'trivia' && !this.used.has(l.id) && (l.delivery === 'leg' || !this.usedGroups.has(groupOf(l.id))),
    );
    if (!fresh.length) return;
    // Long legs: one line at a time from the pool, with a gap between them.
    const legs = fresh.filter((l) => l.delivery === 'leg');
    if (legs.length && now - this.lastLeg >= LEG_GAP && !this.queue.some((q) => q.line.delivery === 'leg')) {
      const l = legs[0];
      this.take(l);
      this.queue.push({ line: l, until: now + EXPIRES.leg });
      this.lastLeg = now;
    }
    // Others: one line of each group (chosen at random among its alternatives), in order.
    const groups = new Map<string, NarrativeLine[]>();
    for (const l of fresh) {
      if (l.delivery === 'leg') continue;
      const g = groupOf(l.id);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(l);
    }
    for (const options of groups.values()) {
      const l = options[Math.floor(this.random() * options.length)];
      this.take(l);
      if (l.delivery === 'curiosity') {
        this.heard.push(this.caption(l));
        continue;
      }
      const item = { line: l, until: now + EXPIRES[l.delivery] };
      // Cues and reflections go before the stories waiting for a calm moment.
      if (l.delivery === 'cue' || l.delivery === 'reflection') {
        const at = this.queue.findIndex((q) => q.line.delivery !== 'cue' && q.line.delivery !== 'reflection');
        this.queue.splice(at < 0 ? this.queue.length : at, 0, item);
      } else this.queue.push(item);
    }
  }

  private pickAck(speaker: string): NarrativeLine | undefined {
    const acks = this.lines.filter((l) => l.delivery === 'ack');
    const own = acks.filter((l) => l.speaker === speaker);
    const pool = (own.length ? own : acks).filter((l) => l.id !== this.lastAck);
    const ack = pool.length ? pool[Math.floor(this.random() * pool.length)] : acks[0];
    if (ack) this.lastAck = ack.id;
    return ack;
  }

  private take(l: NarrativeLine): void {
    this.used.add(l.id);
    if (l.delivery !== 'leg') this.usedGroups.add(groupOf(l.id));
  }

  /**
   * The caption to show now (or null), every frame. `calm`: no manoeuvre or trouble just now,
   * so a story may start.
   */
  update(now: number, calm: boolean): Caption | null {
    if (this.current && now < this.current.until) return this.current.caption;
    if (this.current) {
      this.nextFree = this.current.until + PAUSE;
      this.quietSince = this.current.until;
      this.current = null;
    }
    if (!calm) this.quietSince = now;
    if (now < this.nextFree) return null;
    // Drop what waited too long.
    for (let i = this.queue.length - 1; i >= 0; i--) if (this.queue[i].until < now) this.queue.splice(i, 1);
    const i = this.queue.findIndex((q) => calm || q.line.delivery === 'cue' || q.line.delivery === 'reflection' || q.line.delivery === 'ack');
    if (i >= 0) {
      const [{ line }] = this.queue.splice(i, 1);
      return this.show(line, now);
    }
    // A quiet moment: the story continues, or a piece of trivia.
    if (calm && now - this.quietSince >= this.idleNeed) {
      const next = this.lines.find((l) => l.delivery === 'leg' && !this.used.has(l.id)) ?? this.trivia.find((l) => !this.used.has(l.id));
      if (next) {
        this.take(next);
        return this.show(next, now);
      }
      this.quietSince = now; // nothing left to say: stay quiet
    }
    return null;
  }

  private show(line: NarrativeLine, now: number): Caption {
    const caption = this.caption(line);
    this.current = { caption, until: now + readingTime(caption.text) };
    this.idleNeed = this.drawIdle();
    // A cue that asks for an action waits for it.
    if (line.delivery === 'cue' && line.expects?.length) {
      this.expecting = { moments: new Set(line.expects), until: now + (line.within ?? ACK_WINDOW), speaker: line.speaker };
    }
    return caption;
  }

  /**
   * At the end of the mission: the lines still waiting (the closing words), for the result
   * panel, since the game stops before they could be shown.
   */
  flush(): Caption[] {
    const out = this.queue.filter((q) => q.line.delivery !== 'cue' && q.line.delivery !== 'ack').map((q) => this.caption(q.line));
    this.queue.length = 0;
    this.current = null;
    return out;
  }

  /** The curiosities collected during the mission, for the logbook. */
  get logbook(): Caption[] {
    return this.heard;
  }

  /** The sources of the bank, for the logbook. */
  get credits(): string[] {
    return (this.bank.credits ?? []).map((c) => c.title);
  }
}
