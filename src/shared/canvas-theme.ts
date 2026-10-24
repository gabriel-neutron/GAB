/** The canvas libraries need a resolved theme, including the system choice. */
export const canvasTheme = (): 'light' | 'dark' =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

/** Paint changes keep the camera, selection and filters in place. */
export function observeCanvasTheme(paint: (theme: 'light' | 'dark') => void): () => void {
  let held = canvasTheme();
  const observer = new MutationObserver(() => {
    const next = canvasTheme();
    if (next === held) return;
    held = next;
    paint(next);
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}
