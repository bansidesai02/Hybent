/**
 * useFillShell
 *
 * Makes the current page fill the shell's `<main>` container edge-to-edge:
 * no responsive padding, no max-width cap, no scroll on the shell layer.
 * The page itself is responsible for all internal scrolling.
 *
 * Restores every override on unmount so every other page is unaffected.
 *
 * Usage: call at the top of any page component that needs a full-bleed layout
 * (e.g. CopilotPage's two-pane split).
 */
import { useEffect } from 'react'

export function useFillShell() {
  useEffect(() => {
    const main = document.querySelector<HTMLElement>('main')
    if (!main) return

    // The shell wraps <Outlet /> in an extra `<div class="mx-auto w-full max-w-[1440px]">`.
    const wrapper = main.querySelector<HTMLElement>(':scope > div')

    // Snapshot current inline styles so we can restore them exactly on unmount.
    const prev = {
      mainOverflow:    main.style.overflow,
      mainPadding:     main.style.padding,
      mainBackground:  main.style.background,
      wrapperHeight:   wrapper?.style.height    ?? '',
      wrapperMinH:     wrapper?.style.minHeight ?? '',
      wrapperMaxWidth: wrapper?.style.maxWidth  ?? '',
    }

    // Remove scroll and padding so the page can manage its own layout.
    main.style.overflow   = 'hidden'
    main.style.padding    = '0'
    main.style.background = 'rgb(var(--hb-surface))'

    // Let the wrapper fill main and collapse min-height so flex works correctly.
    if (wrapper) {
      wrapper.style.height    = '100%'
      wrapper.style.minHeight = '0'
      wrapper.style.maxWidth  = '100%'
    }

    return () => {
      main.style.overflow   = prev.mainOverflow
      main.style.padding    = prev.mainPadding
      main.style.background = prev.mainBackground
      if (wrapper) {
        wrapper.style.height    = prev.wrapperHeight
        wrapper.style.minHeight = prev.wrapperMinH
        wrapper.style.maxWidth  = prev.wrapperMaxWidth
      }
    }
  }, [])
}
