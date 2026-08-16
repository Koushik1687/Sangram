/* ==========================================================================
   StarField — twinkling starfield on a full-page canvas plus the solar
   system bodies, ported from the original stars.js.

   Performance notes (the original burned the main thread by):
     · sizing the canvas to the full document height and repainting it every
       frame, even when the tab was hidden;
     · drawing up to 1200 stars with ctx.shadowBlur set per star — shadow
       blur is one of the most expensive canvas operations there is;
     · rebuilding radial gradients + shadows for every planet each frame.

   This version keeps the same look but:
     · sizes the canvas to the *viewport* (it is position:fixed, so that is
       all that is ever visible) with devicePixelRatio capped at 2;
     · pre-renders one soft-glow star sprite and one sprite per planet
       (gradients, glow and rings baked in) at setup time, then paints them
       with drawImage — cheap per frame;
     · twinkles stars by modulating globalAlpha instead of per-star shadows;
     · pauses the animation loop while the document is hidden and renders a
       single static frame under prefers-reduced-motion.
   ========================================================================== */
import { useEffect, useRef } from 'react'

const PLANETS = [
  { name: 'Sun', x: 0.5, y: 0.12, r: 22, glow: '#fff5c0', color: '#ffb800', orbit: 0.0, isSun: true },
  { name: 'Mercury', x: 0.14, y: 0.2, r: 5, glow: '#d7d7d7', color: '#b8b8b8', orbit: 0.12 },
  { name: 'Venus', x: 0.24, y: 0.3, r: 7, glow: '#ffe7a8', color: '#f5d17a', orbit: 0.22 },
  { name: 'Earth', x: 0.34, y: 0.16, r: 7.5, glow: '#8dc7ff', color: '#4aa3ff', orbit: 0.35 },
  { name: 'Mars', x: 0.44, y: 0.35, r: 6, glow: '#ffb2a1', color: '#d65b4a', orbit: 0.48 },
  { name: 'Jupiter', x: 0.6, y: 0.24, r: 14, glow: '#f7c9a5', color: '#d7955b', orbit: 0.64 },
  { name: 'Saturn', x: 0.72, y: 0.4, r: 12, glow: '#f3e2ac', color: '#d6c27d', orbit: 0.8, hasRing: true },
  { name: 'Uranus', x: 0.8, y: 0.28, r: 9, glow: '#c5f3ff', color: '#7ecfe5', orbit: 0.94 },
  { name: 'Neptune', x: 0.88, y: 0.55, r: 9.5, glow: '#a5c6ff', color: '#4d85d8', orbit: 1.08 },
  { name: 'Pluto', x: 0.76, y: 0.7, r: 4.5, glow: '#d8c5b4', color: '#a58872', orbit: 1.24 },
]

/* Allocate an offscreen canvas and let the caller paint into it once. */
function makeSprite(size, paint) {
  const c = document.createElement('canvas')
  const px = Math.ceil(size)
  c.width = px
  c.height = px
  const g = c.getContext('2d')
  paint(g, px / 2, px / 2, px / 2 - 1)
  return c
}

function paintPlanet(g, cx, cy, radius, color, glow, index) {
  const grad = g.createRadialGradient(cx - radius * 0.25, cy - radius * 0.35, radius * 0.2, cx, cy, radius * 2.4)
  grad.addColorStop(0, '#fffef5')
  grad.addColorStop(0.18, glow)
  grad.addColorStop(0.72, color)
  grad.addColorStop(1, 'rgba(20,20,40,0.82)')
  g.shadowColor = glow
  g.shadowBlur = 16 + radius * 1.4
  g.beginPath()
  g.fillStyle = grad
  g.arc(cx, cy, radius, 0, Math.PI * 2)
  g.fill()
  g.shadowBlur = 0

  const planet = PLANETS[index]
  if (planet?.hasRing) {
    g.beginPath()
    g.strokeStyle = 'rgba(130,98,16,0.5)'
    g.lineWidth = 1.6
    g.ellipse(cx, cy, radius * 2.2, radius * 0.55, index * 0.5, 0, Math.PI * 2)
    g.stroke()
    g.beginPath()
    g.strokeStyle = 'rgba(234,179,8,0.35)'
    g.lineWidth = 0.9
    g.ellipse(cx, cy, radius * 2.6, radius * 0.68, index * 0.5, 0, Math.PI * 2)
    g.stroke()
  } else if (radius > 9) {
    g.beginPath()
    g.strokeStyle = 'rgba(130,98,16,0.35)'
    g.lineWidth = 0.9
    g.ellipse(cx - radius * 0.15, cy, radius * 0.85, radius * 0.35, index * 0.5, 0, Math.PI * 2)
    g.stroke()
  }
}

export default function StarField() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let rafId = 0
    let w = 0
    let h = 0
    let dpr = 1
    let stars = []
    let starSprite = null
    let planetSprites = []
    let orbitEls = null
    const heroEl = document.getElementById('hero')
    const hasHero = !!heroEl
    let heroVisible = hasHero

    function buildStars() {
      const count = Math.min(400, Math.floor((w * h) / 1400))
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.6 + 0.6,
        base: Math.random() * 0.7 + 0.35,
        speed: Math.random() * 0.0009 + 0.002,
        phase: Math.random() * Math.PI * 2,
        alpha: Math.random() * 0.5 + 0.5,
      }))
    }

    /* Bake the soft golden star glow once, then reuse it every frame. */
    function buildStarSprite() {
      starSprite = makeSprite(24, (g, cx, cy, r) => {
        const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r)
        grad.addColorStop(0, 'rgba(255,240,190,0.95)')
        grad.addColorStop(0.3, 'rgba(234,179,8,0.45)')
        grad.addColorStop(1, 'rgba(234,179,8,0)')
        g.fillStyle = grad
        g.fillRect(0, 0, 24, 24)
      })
    }

    /* Bake each planet (gradients + glow + rings) once at setup time. */
    function buildPlanetSprites() {
      planetSprites = PLANETS.map((p, index) => {
        if (p.isSun) {
          return makeSprite(220, (g, cx, cy) => {
            const corona = g.createRadialGradient(cx, cy, p.r * 0.3, cx, cy, p.r * 4.5)
            corona.addColorStop(0, 'rgba(255,220,80,0.45)')
            corona.addColorStop(0.35, 'rgba(255,180,0,0.15)')
            corona.addColorStop(1, 'rgba(255,140,0,0)')
            g.beginPath()
            g.fillStyle = corona
            g.arc(cx, cy, p.r * 4.5, 0, Math.PI * 2)
            g.fill()
            const inner = g.createRadialGradient(cx - p.r * 0.2, cy - p.r * 0.2, p.r * 0.15, cx, cy, p.r * 1.6)
            inner.addColorStop(0, '#fffff0')
            inner.addColorStop(0.25, '#ffe88a')
            inner.addColorStop(0.6, '#ffb800')
            inner.addColorStop(1, 'rgba(200,100,0,0.6)')
            g.beginPath()
            g.fillStyle = inner
            g.shadowColor = '#ffcc00'
            g.shadowBlur = 40 + p.r
            g.arc(cx, cy, p.r, 0, Math.PI * 2)
            g.fill()
            g.shadowBlur = 0
          })
        }
        return makeSprite(p.r * 6 + 40, (g, cx, cy) => paintPlanet(g, cx, cy, p.r, p.color, p.glow, index))
      })
    }

    function resize() {
      /* Cap at 1.5×: the starfield is soft glows over the page background, so
         the slight softening vs 2× is invisible, while the canvas raster
         work per frame drops by ~44%. */
      dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      buildStars()
    }

    function draw(t) {
      ctx.clearRect(0, 0, w, h)

      for (const s of stars) {
        const twinkle = reduceMotion ? s.base : s.base + Math.sin(t * s.speed + s.phase) * 0.55
        const alpha = Math.max(0.08, Math.min(0.5, twinkle * s.alpha * 0.55))
        const size = s.r * 7
        ctx.globalAlpha = alpha
        ctx.drawImage(starSprite, s.x - size / 2, s.y - size / 2, size, size)
      }
      ctx.globalAlpha = 1

      PLANETS.forEach((planet, index) => {
        const driftX = Math.sin(t * 0.00012 + planet.orbit * 6) * (30 + index * 2.5)
        const driftY = Math.cos(t * 0.00009 + planet.orbit * 5) * (18 + index * 1.5)
        const px = planet.x * w + driftX
        const py = planet.y * h + driftY
        const sprite = planetSprites[index]
        if (!sprite) return
        const dw = planet.isSun ? sprite.width * (1 + Math.sin(t * 0.0004) * 0.06) : sprite.width
        const dh = planet.isSun ? sprite.height * (1 + Math.sin(t * 0.0004) * 0.06) : sprite.height
        ctx.drawImage(sprite, px - dw / 2, py - dh / 2, dw, dh)
      })
    }

    /* Paint loop. On hero pages the IntersectionObserver starts/stops it as
       the hero enters/leaves the viewport. On pages without a hero (login,
       shop, …) it runs throttled to ~30fps: repainting a full canvas at 60fps
       behind a static page is pure wasted CPU. */
    let lastPaint = 0
    function loop(t) {
      if (!hasHero && performance.now() - lastPaint < 33) {
        rafId = requestAnimationFrame(loop)
        return
      }
      lastPaint = performance.now()
      draw(t)
      rafId = requestAnimationFrame(loop)
    }

    function onMouseMove(e) {
      if (!orbitEls) orbitEls = Array.from(document.querySelectorAll('.orbit-planet'))
      if (orbitEls.length === 0) return
      const px = e.clientX / window.innerWidth - 0.5
      const py = e.clientY / window.innerHeight - 0.5
      orbitEls.forEach((p, i) => {
        const depth = (i + 1) * 6
        p.style.transform = `translate(${px * depth}px, ${py * depth}px)`
      })
    }

    let resizeRaf = 0
    const onResize = () => {
      cancelAnimationFrame(resizeRaf)
      resizeRaf = requestAnimationFrame(() => {
        resize()
        if (reduceMotion) draw(performance.now())
      })
    }

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafId)
        rafId = 0
      } else if (!reduceMotion && heroVisible && !rafId) {
        rafId = requestAnimationFrame(loop)
      }
    }

    /* Pause the animation while the hero — the only place the starfield
       motion really matters — is off-screen. The canvas is position:fixed,
       so the last painted frame simply stays visible; a static starfield
       costs nothing instead of repainting a full-canvas every frame. */
    let heroObserver = null
    if (heroEl && 'IntersectionObserver' in window) {
      heroObserver = new IntersectionObserver(([entry]) => {
        heroVisible = entry.isIntersecting
        if (heroVisible) {
          if (!reduceMotion && !rafId) rafId = requestAnimationFrame(loop)
        } else {
          cancelAnimationFrame(rafId)
          rafId = 0
        }
      })
      heroObserver.observe(heroEl)
    }

    buildStarSprite()
    buildPlanetSprites()
    window.addEventListener('resize', onResize)
    if (!reduceMotion) window.addEventListener('mousemove', onMouseMove)
    document.addEventListener('visibilitychange', onVisibility)
    resize()
    if (reduceMotion) draw(performance.now())
    else rafId = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('visibilitychange', onVisibility)
      heroObserver?.disconnect()
      cancelAnimationFrame(rafId)
      cancelAnimationFrame(resizeRaf)
    }
  }, [])

  return <canvas id="star-canvas" ref={canvasRef}></canvas>
}
