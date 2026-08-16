/* ==========================================================================
   viewTransition.js — tiny helper for the View Transitions API.
   Wraps a React state commit (flushed synchronously) in
   document.startViewTransition() so drawer / modal opens get a smooth
   crossfade + slide instead of a hard cut. Falls back to an instant commit
   in browsers without support, for reduced-motion users, or when a
   transition is already running (e.g. rapid double-clicks).
   ========================================================================== */
import { flushSync } from 'react-dom'

const reduced =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function withViewTransition(commit) {
  if (typeof document !== 'undefined' && document.startViewTransition && !reduced) {
    // Mark the root so CSS can silence the elements' own transitions while
    // the view-transition snapshots provide the animation instead.
    document.documentElement.classList.add('vt')
    try {
      document.startViewTransition(() => flushSync(commit))
      return
    } catch (e) {
      /* a transition is already running — fall through to an instant commit */
    }
  }
  commit()
}
