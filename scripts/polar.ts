// Print speed polars for every boat and mode:  npm run polar [windSpeed m/s]
import { BOATS, polar } from '../src/physics';

const wind = Number(process.argv[2] ?? 6);
const angles = [30, 40, 45, 50, 60, 75, 90, 110, 135, 150, 165, 180];

for (const boat of BOATS) {
  for (const mode of boat.modes) {
    console.log(`\n${boat.name} — ${mode.name} — true wind ${wind} m/s (${(wind / 0.5144).toFixed(1)} kn)`);
    console.log('TWA   speed kn  leeway kn  heel°  best sheet');
    for (const p of polar(boat, mode.id, wind, angles)) {
      console.log(
        `${String(p.twaDeg).padStart(3)}°  ${p.surgeKn.toFixed(2).padStart(8)}  ${p.swayKn.toFixed(2).padStart(9)}  ${p.heelDeg
          .toFixed(1)
          .padStart(5)}  ${p.bestSheet.toFixed(1)}`,
      );
    }
  }
}
