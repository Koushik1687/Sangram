/* Scroll-reveal — adds the .in class to [data-reveal] elements as they
   enter the viewport (ported from the original main.js). Re-runs when the
   given dependencies change so dynamically-rendered sections reveal too. */
import { useEffect } from 'react'

export function useScrollReveal(deps = []) {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]')

    /* Reveal one element: stagger siblings by a few ms so a grid doesn't
       start all its 0.8s opacity/transform transitions in the same frame —
       that paint spike is what shows up as long tasks while scrolling. */
    const reveal = (el) => {
      const parent = el.parentElement
      const idx = parent ? Array.from(parent.children).indexOf(el) : 0
      const delay = Math.min(idx, 5) * 0.06
      if (delay > 0) {
        el.style.transitionDelay = `${delay}s`
        window.setTimeout(() => {
          el.style.transitionDelay = ''
        }, delay * 1000 + 900)
      }
      el.classList.add('in')
    }

    if (!('IntersectionObserver' in window)) {
      els.forEach(reveal)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal(entry.target)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.14 },
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
