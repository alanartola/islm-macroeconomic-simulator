import type { LabConfig } from '../lab/scenario';

/**
 * Configuration of the module currently on screen, registered by its
 * "Guardar experimento" control so the top-bar share link can reproduce it
 * (modules E, F and G keep their state locally).
 */
let current: LabConfig | null = null;

export function setCurrentConfig(cfg: LabConfig | null): void {
  current = cfg;
}

export function getCurrentConfig(): LabConfig | null {
  return current;
}
