export interface ScrollProgressController {
  readonly progress: number;
  readonly controlled: boolean;
  update(): void;
  dispose(): void;
}

export function createScrollProgress(
  section: HTMLElement,
  onProgress: (progress: number) => void,
): ScrollProgressController {
  let currentProgress = 0;
  let scrollControlled = window.scrollY > 1;
  let frameId = 0;

  const calculateProgress = (): number => {
    const rect = section.getBoundingClientRect();
    const scrollableDistance = Math.max(
      section.offsetHeight - window.innerHeight,
      1,
    );
    return Math.min(Math.max(-rect.top / scrollableDistance, 0), 1);
  };

  const update = (): void => {
    frameId = 0;
    if (!scrollControlled && window.scrollY <= 1) return;
    scrollControlled = true;
    currentProgress = calculateProgress();
    onProgress(currentProgress);
  };

  const requestUpdate = (): void => {
    if (frameId !== 0) return;
    frameId = window.requestAnimationFrame(update);
  };

  const beginScrollControl = (): void => {
    scrollControlled = true;
    requestUpdate();
  };

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  window.addEventListener('wheel', beginScrollControl, { passive: true });
  window.addEventListener('touchstart', beginScrollControl, { passive: true });

  if (scrollControlled) {
    update();
  }

  return {
    get progress(): number {
      return currentProgress;
    },
    get controlled(): boolean {
      return scrollControlled;
    },
    update,
    dispose(): void {
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      window.removeEventListener('wheel', beginScrollControl);
      window.removeEventListener('touchstart', beginScrollControl);
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
    },
  };
}
