# Content: texts and mini-games

Everything here can be changed without touching the code. Edit the files (on GitHub, the
pencil button), and the game picks the changes up at the next build.

## Texts — `texts/pt.txt`, `texts/en.txt`, `texts/fr.txt`

Every word the site and the game show, one text per line:

```
land.play = Jogar
goal.buoy = Boia {n} de {total}
```

- Change only what comes after the `=`. The key before it is how the game finds the text,
  and it must be the same in the three files.
- `{n}`, `{total}`, `{boat}`… are filled in by the game: keep them (the same ones in every
  language).
- `<em>…</em>` (italic) and `<strong>…</strong>` (bold) may be used.
- Lines starting with `#` are notes and section headings.
- Portuguese is the default language; a text missing in French or English shows in Portuguese.

The landing page is in the `land.*`, `boat.*`, `sail.*` and `area.*` lines; the drills in
`drill.*`; the mini-games in `mini.*` (`mini.<id>` is a card's title, `mini.<id>.desc` its line
under it).

## Drills and mini-games — `minigames.json`

The museum menu: first the drills (the "Learn to sail" row), then the mini-games, in the order
of the file. Each entry:

| field | meaning |
|---|---|
| `id` | its name; the title and description are the texts `drill.<id>` / `mini.<id>` (and `.desc`) |
| `show` | `false` hides it from the menu |
| `area` | `tejo`, `medio`, `arcachon`, `aveiro`, `azores`, `madeira` |
| `boat` | `falua`, `muleta`, `fragata`, `catraio`, `canoa`, `pinasse`, `moliceiro`, `baleeiro`, `bac` |
| `from` / `at` | a port of that area, written as in the menu's port list |

Drills (`drill` is the kind: `hold`, `gybe`, `tack`, `slalom`, `anchor`):

- `hold`: `seconds` on a beam reach;
- `gybe`, `tack`: `turns` to make;
- `slalom`: `turns` (tacks, one buoy each) within `seconds`;
- `anchor`: `distance` to the anchor spot, m.

`drillRules` applies to all drills: the beam reach (`beamFromDeg`–`beamToDeg`, wind angle off
the bow), the heel that counts as a capsize (`capsizeHeelDeg`), how far in the sheet must be for
a controlled gybe (`gybeSheetMax`, 0 = hauled in, 1 = let out), and the speed that counts as
stopped (`stopSpeedKnots`).

Mini-games (`type`):

- `run`: from a port to a mark `distance` m away, `direction` `downwind` or `upwind`;
- `transport`: `from` a port `to` another; `busy: true` adds many boats, gusts and wind shifts;
- `whales`: whale watching, `from` a port;
- `seaweed`: gather `count` floating mats of seaweed off the port `at`;
- `fishing`: catch `kg` of fish off the port `at` (with the muleta's net);
- `supply`: `from` a port out to a boat (`meetBoat`) at anchor at `meet` (latitude, longitude)
  and back.

If a number changes, change the matching text too (for example "30 s" in `drill.hold.desc`).

## Checking

`npm test` checks both: every text line is `key = text`, the three languages have the same keys
and `{…}`, and the mini-games file names real areas, boats and ports and has the fields its
type needs. A mistake in `minigames.json` also shows in the game for a few seconds when it
starts (and in the browser console).
