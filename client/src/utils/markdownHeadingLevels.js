// Shared between the Settings page (where these are edited) and the Daily
// Plan page (where they're used to build the markdown export), so both
// agree on the storage key, valid range, and defaults.
export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6];
export const HEADING_LEVELS_STORAGE_KEY = 'macroPlanner.markdownHeadingLevels';
export const DEFAULT_HEADING_LEVELS = { title: 1, section: 2 };

export function loadHeadingLevels() {
  try {
    const saved = JSON.parse(localStorage.getItem(HEADING_LEVELS_STORAGE_KEY));
    if (saved && HEADING_LEVELS.includes(saved.title) && HEADING_LEVELS.includes(saved.section)) {
      return saved;
    }
  } catch {
    // ignore malformed/absent saved value, fall back to defaults below
  }
  return DEFAULT_HEADING_LEVELS;
}
