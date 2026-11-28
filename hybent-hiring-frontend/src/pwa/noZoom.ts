/**
 * No pinch zoom on iOS. Safari ignores `user-scalable=no` in the viewport
 * meta (an accessibility choice by Apple), so the pinch gesture is stopped
 * here instead. Android and desktop browsers honour the meta tag.
 */
if (typeof document !== 'undefined') {
  const stop = (e: Event) => e.preventDefault()
  document.addEventListener('gesturestart', stop, { passive: false })
  document.addEventListener('gesturechange', stop, { passive: false })
  document.addEventListener('gestureend', stop, { passive: false })
}
export {}
