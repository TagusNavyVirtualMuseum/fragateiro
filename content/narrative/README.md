# Narrative: the shared folder between the game and the narrative tool

This folder is how the game (fragateiro) and the narrative tool
([sailnarratives](https://github.com/maclopes/sailnarratives)) talk to each other. Neither side
reads the other's code; both read and write files here, following this contract.

Nothing in the game uses this folder yet. The narration (captions, later voice) will be added
behind a setting, one mini-game first, as described in the tool's
`docs/game-integration-plan.md`.

## Who owns what

| Path | Written by | Read by | What it is |
| --- | --- | --- | --- |
| `contract.json` | both, by agreement | both | the contract version and the language list |
| `schema/` | both, by agreement | both | JSON schemas of the files below |
| `from-game/world.json` | the game | the tool | ports, places, landmarks, boats and activities (mini-games and drills) of the game |
| `from-game/moments.json` | the game | the tool | the moments the game can report to the narrator (tack, gybe, arrival, `near_place:<name>`…) |
| `from-tool/index.json` | the tool | the game | the list of line banks |
| `from-tool/lines/<mini-game>.json` | the tool | the game | one line bank per mini-game: reviewed lines in pt and en (fr later) |
| `from-tool/audio/<lang>/<line>.ogg` | the tool (later) | the game | recorded or generated speech, one file per line and language |

Rules:

1. **One owner per file.** Only the owner changes a file. If the other side needs a change, it
   asks (an issue or a pull request for the owner to review).
2. **The game describes itself; the tool writes words.** The game never writes line text here;
   the tool never changes the game's world or moments.
3. **Changes arrive as pull requests**, so the game's developers see every change to lines
   before it ships.
4. **No code is copied.** When the narrator runtime exists, the game uses it as a pinned
   dependency, not as files pasted here.

## Versions

`contract.json` holds `version` (now 1). Adding an optional field keeps the version; renaming or
removing a field, or changing what one means, raises it, and both sides update together. Every
file here carries the `version` it was written for.

## Line banks (`from-tool/lines/<mini-game>.json`)

The file name is the mini-game's `id` in `content/minigames.json`. A line bank follows
`schema/line-bank.schema.json`; in short:

```json
{
  "version": 1,
  "minigame": "fishing",
  "variant": "historical",
  "languages": ["pt", "en"],
  "cast": [{"id": "k1", "name": {"pt": "Arrais Joaquim", "en": "Arrais Joaquim"}, "fictional": true}],
  "lines": [{
    "id": "fishing.b1.l1",
    "beat": "setup",
    "trigger": "start",
    "delivery": "story",
    "speaker": "k1",
    "text": {"pt": "Largamos do Seixal. …", "en": "We leave Seixal. …"},
    "fictional": false,
    "sources": ["m-hist-pedrosa:…:p12"],
    "status": "verified"
  }],
  "missing": [],
  "evidence": [{"id": "m-hist-pedrosa:…:p12", "source": "Pedrosa", "location": "1. Introdução", "paraphrase": "…"}],
  "credits": [{"id": "m-hist-pedrosa", "title": "…", "licence": "copyright: cited and paraphrased"}]
}
```

- `trigger` is a moment id from `from-game/moments.json`, or `near_place:<name>` with a name from
  `from-game/world.json`.
- `delivery` says when it may play: `cue` (short, may play during a manoeuvre), `story` (only
  when sailing is calm), `reflection` (right after a manoeuvre), `leg` (a pool for long steady
  legs, played in turn), `curiosity` (a card in the end-of-mission logbook).
- `when` (optional) limits a line to some of the mini-game's boats, areas or places. Lines
  without `when` play in every option. An option without its own lines uses only the general
  ones.
- Every language listed in `languages` has a text for every line. Portuguese is the default.
- `status`: `verified` (every factual claim passed the tool's checks against its evidence, not
  yet approved by the author) or `approved` (approved by the author). **The game plays only
  approved lines**, except in a playtest mode. Lines that failed a check are never exported.
- `sources` point to `evidence`: the passages each line rests on, paraphrased, never quoted
  (most sources are under copyright). `credits` names the sources for the logbook or credits.
- `missing` lists story parts (setup, close) that have no exported line yet.

## The game's side (`from-game/`)

`world.json` and `moments.json` are written for the game by the tool's builder for now
(`domains/sailing/scripts/build_game_world.py` in sailnarratives), from the game's maps,
`content/minigames.json` and boat files. Later the game should generate them itself with a
script, so they always match the release. `moments.json` is a proposal until the game's
narrator hooks emit these moments.

## Checks

- In the game, `tests/narrative.test.ts` checks this folder: every bank in the index exists,
  every trigger is a known moment or place, every boat, area and place in `when` exists, every
  line has every language, and ids are unique.
- In the tool, the export runs the same checks before it writes, plus its own (sources, word
  limits, anachronisms).
