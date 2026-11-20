import { resolve } from 'node:path';

export const RESTART_SIGNAL = resolve(import.meta.dirname, '..', '..', 'state', 'engine-restart.signal');
