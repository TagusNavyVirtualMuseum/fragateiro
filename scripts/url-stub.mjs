// Lets Node scripts import game files that use Vite's `?url` imports (for example
// src/engine/boatVisuals.ts): each such import (and any model or image file) becomes an
// empty string.
//   npx tsx --import ./scripts/url-stub.mjs scripts/some-script.ts
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier.endsWith('?url')) return { url: 'data:text/javascript,export default ""', shortCircuit: true };
  return next(specifier, context);
}
export async function load(url, context, next) {
  const path = url.split('?')[0];
  if (['.glb', '.png', '.jpg', '.webp'].some((e) => path.endsWith(e))) return { format: 'module', source: 'export default ""', shortCircuit: true };
  return next(url, context);
}`),
  import.meta.url,
);
