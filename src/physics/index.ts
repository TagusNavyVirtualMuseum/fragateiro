// Public entry point of the sailing physics. This folder must not import Babylon.js
// (or anything that touches the browser), so it can be tested and reused anywhere.

export * from './types';
export * from './foil';
export * from './wind';
export * from './simulator';
export * from './polar';
export * from './autotrim';
export { FALUA } from './boats/falua';
export { MULETA } from './boats/muleta';
export { FRAGATA } from './boats/fragata';
export { CATRAIO } from './boats/catraio';
export { CANOA } from './boats/canoa';
export { PINASSE } from './boats/pinasse';
export { MOLICEIRO } from './boats/moliceiro';
export { RABELO } from './boats/rabelo';

import { CANOA } from './boats/canoa';
import { CATRAIO } from './boats/catraio';
import { FALUA } from './boats/falua';
import { FRAGATA } from './boats/fragata';
import { MULETA } from './boats/muleta';
import { PINASSE } from './boats/pinasse';
import { MOLICEIRO } from './boats/moliceiro';
import { RABELO } from './boats/rabelo';
export const BOATS = [FALUA, MULETA, FRAGATA, CATRAIO, CANOA, PINASSE, MOLICEIRO];
/** Boats still being worked on: tested, but not offered in the games yet. */
export const BOATS_IN_DEVELOPMENT: typeof BOATS = [RABELO];
