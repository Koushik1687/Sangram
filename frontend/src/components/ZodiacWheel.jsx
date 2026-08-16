/* ==========================================================================
   ZodiacWheel — the rotating wheel of 12 zodiac signs in the hero
   (ported from main.js). Selected sign is shown in the wheel core.
   ========================================================================== */
import { useEffect, useRef, useState } from 'react'

const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
]

export default function ZodiacWheel() {
  const [selected, setSelected] = useState(SIGNS[0])
  const wheelRef = useRef(null)

  useEffect(() => {
    const wheel = wheelRef.current
    if (!wheel) return
    const updateWheelRadius = () => {
      const w = wheel.clientWidth || 440
      const radius = Math.floor(w / 2 - 24)
      wheel.style.setProperty('--wheel-r', `${radius}px`)
    }
    updateWheelRadius()
    window.addEventListener('resize', updateWheelRadius)
    return () => window.removeEventListener('resize', updateWheelRadius)
  }, [])

  return (
    <div className="zodiac-wheel" id="zodiacWheel" ref={wheelRef}>
      <div className="wheel-core">
        <span>ॐ</span>
        <small id="wheelSelectedSign">{selected}</small>
      </div>
      {SIGNS.map((name, i) => {
        const angleDeg = (i / SIGNS.length) * 360 - 90
        return (
          <div className="sign-slot" key={name} style={{ '--angle': `${angleDeg}deg` }}>
            <div
              className={`sign${selected === name ? ' selected' : ''}`}
              data-sign={name}
              tabIndex={0}
              role="button"
              aria-label={name}
              onClick={() => setSelected(name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setSelected(name)
                }
              }}
            >
              <img src={`/images/Zodiac Signs/${name}.png`} alt={name} className="sign-img" decoding="async" />
              <span className="sign-name">{name}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
