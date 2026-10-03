/**
 * useFillShell
 *
 * Makes the current page fill the shell's `<main>`: no scroll on the shell
 * layer, a slim gutter in place of the responsive one (up to 48px), and no
 * max-width cap. The page itself is responsible for all internal scrolling.
 *
 * Restores every override on unmount so every other page is unaffected.
 *
 * Usage: call at the top of any page whose panels scroll on their own
 * (e.g. CopilotPage's conversation list and thread).
 */
import { useEffect } from 'react'

export function useFillShell() {
  useEffect(() => {
    const main = document.querySelector<HTMLElement>('main')
    if (!main) return

    // The shell wraps <Outlet /> in an extra `<div class="mx-auto w-full max-w-[1440px]">`.
    const wrapper = main.querySelector<HTMLElement>(':scope > div')

    const prev = {
      mainOverflow:    main.style.overflow,
      mainPadding:     main.style.padding,
      wrapperHeight:   wrapper?.style.height    ?? '',
      wrapperMinH:     wrapper?.style.minHeight ?? '',
      wrapperMaxWidth: wrapper?.style.maxWidth  ?? '',
    }

    main.style.overflow = 'hidden'
    main.style.padding  = 'clamp(12px, 1.4vw, 20px)'
    if (wrapper) {
      wrapper.style.height    = '100%'
      wrapper.style.minHeight = '0'
      wrapper.style.maxWidth  = 'none'
    }

    return () => {
      main.style.overflow = prev.mainOverflow
      main.style.padding  = prev.mainPadding
      if (wrapper) {
        wrapper.style.height    = prev.wrapperHeight
        wrapper.style.minHeight = prev.wrapperMinH
        wrapper.style.maxWidth  = prev.wrapperMaxWidth
      }
    }
  }, [])
}
