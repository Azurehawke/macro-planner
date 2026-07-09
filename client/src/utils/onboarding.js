// Per-browser, like the theme and markdown-heading preferences - a new
// visitor sees it once per device, and can reopen it anytime from the nav.
export const ONBOARDING_STORAGE_KEY = 'macroPlanner.onboardingComplete';

export function hasCompletedOnboarding() {
  return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
}

export function markOnboardingComplete() {
  localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
}
