export function scrollToSection(targetId: string, event?: Event): void {
  event?.preventDefault();
  const el = document.getElementById(targetId);
  if (!el) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}
