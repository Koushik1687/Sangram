/* ==========================================================================
   usePauseAnimWhenHidden — pauses a section's decorative CSS animations
   while the section is off-screen. CSS animations cost a per-frame style
   recalc (UpdateLayoutTree) even when invisible, which is the dominant
   scroll-jank source on this site; pausing them when hidden is invisible
   to the user. The section toggles the `anim-paused` class; the CSS then
   sets animation-play-state: paused on the animated elements.
   ========================================================================== */
import { useEffect } from 'react'

export function usePauseAnimWhenHidden(ref) {
  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([entry]) => {
      el.classList.toggle('anim-paused', !entry.isIntersecting)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
}
