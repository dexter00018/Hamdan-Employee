// Pause color transitions only while changing theme to avoid mixed light/dark frames.
let transitionTimer: ReturnType<typeof setTimeout> | undefined;
export function applyPortalTheme(dark: boolean) {
  const root = document.documentElement;
  root.classList.add('theme-switching');
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => root.classList.remove('theme-switching'), 100);
}
