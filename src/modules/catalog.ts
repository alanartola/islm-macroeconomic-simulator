/** Laboratory modules, in navigation order. */
export const MODULES = ['basic', 'advanced', 'construction', 'policy', 'open', 'adas', 'ismp', 'lab'] as const;
export type LabModuleId = (typeof MODULES)[number];

/** Navigation letters A–H. */
export const LETTER: Record<LabModuleId, string> = { basic: 'A', advanced: 'B', construction: 'C', policy: 'D', open: 'E', adas: 'F', ismp: 'G', lab: 'H' };

/**
 * Thematic groups: the navigation separates them with a rule and the home
 * screen presents the modules as a table of contents organised by these themes.
 */
export const GROUPS: readonly { id: 'closed' | 'open' | 'prices' | 'compare'; modules: readonly LabModuleId[] }[] = [
  { id: 'closed', modules: ['basic', 'advanced', 'construction', 'policy'] },
  { id: 'open', modules: ['open'] },
  { id: 'prices', modules: ['adas', 'ismp'] },
  { id: 'compare', modules: ['lab'] },
];

export function groupOf(m: LabModuleId): (typeof GROUPS)[number]['id'] {
  return GROUPS.find((g) => g.modules.includes(m))!.id;
}
