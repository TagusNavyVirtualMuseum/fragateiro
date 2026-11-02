// Public entry point of the sailing physics. This folder must not import Babylon.js
// (or anything that touches the browser), so it can be tested and reused anywhere.

export * from './types';
export * from './foil';
export * from './wind';
export * from './simulator';
export * from './polar';
export { FALUA } from './boats/falua';
export { MULETA } from './boats/muleta';

import { FALUA } from './boats/falua';
import { MULETA } from './boats/muleta';
export const BOATS = [FALUA, MULETA];
