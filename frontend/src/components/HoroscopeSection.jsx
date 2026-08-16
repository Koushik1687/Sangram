/* ==========================================================================
   HoroscopeSection — daily horoscope with sign pills, range tabs, and the
   detail card with percentage bars (ported from data.js/main.js, using the
   engine in src/lib/horoscope.js).
   ========================================================================== */
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { SIGNS, getReading } from '../lib/horoscope'

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
]

const BARS = [
  { key: 'love', label: 'Love' },
  { key: 'career', label: 'Career' },
  { key: 'health', label: 'Health' },
  { key: 'money', label: 'Money' },
]

function statLabel(v) {
  if (v >= 75) return 'Strong'
  if (v >= 55) return 'Good'
  if (v >= 35) return 'Fair'
  return 'Low'
}

function HoroCard({ sign, range, overrides }) {
  const base = getReading(sign.key, range)
  const o = overrides[sign.key]
  const reading = {
    ...base,
    text: o?.message || base.text,
    color: o?.lucky_color || base.color,
    number: o?.lucky_number || base.number,
    mood: o?.mood || base.mood,
  }
  const [switching, setSwitching] = useState(true)
  const barsRef = useRef(null)

  useEffect(() => {
    setSwitching(true)
    const t = setTimeout(() => {
      setSwitching(false)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          barsRef.current?.querySelectorAll('.horo-bar-fill').forEach((el) => {
            el.style.width = `${el.dataset.pct}%`
          })
        })
      })
    }, 200)
    return () => clearTimeout(t)
  }, [sign, range])

  return (
    <div className={`horo-card${switching ? ' switching' : ''}`} id="horoCard">
      <div className="horo-card-body">
        <div className="horo-card-copy">
          <div className="horo-card-top">
            <div>
              <h3 className="horo-card-title">
                <span className="name">{sign.n}</span> <span>{sign.bn}</span>
              </h3>
              <div className="horo-card-dates">{sign.dates}</div>
            </div>
            <div className="horo-card-date-badge">{range.charAt(0).toUpperCase() + range.slice(1)}</div>
          </div>
          <p className="horo-card-text">{reading.text}</p>
          <div className="horo-card-meta">
            <span>Moon: <b>{reading.mood}</b></span>
            <span>Lucky #: <b>{reading.number}</b></span>
            <span>Color: <b>{reading.color || 'Gold'}</b></span>
          </div>
          <div className="horo-card-actions">
            <button type="button" className="btn primary">Get my detailed horoscope →</button>
            <button type="button" className="btn">Talk to a specialist</button>
          </div>
        </div>
        <div className="horo-card-bars-wrap">
          <div className="horo-bars" ref={barsRef}>
            {BARS.map((b) => (
              <div className="horo-bar-row" key={b.key}>
                <div className="horo-bar-head"><span>{b.label.toUpperCase()}</span><b>{statLabel(reading[b.key])}</b></div>
                <div className="horo-bar-track">
                  <div className={`horo-bar-fill ${b.key}`} data-pct={reading[b.key]}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HoroscopeSection() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [range, setRange] = useState('today')
  const [overrides, setOverrides] = useState({})
  const scrollRef = useRef(null)
  const sign = SIGNS[activeIndex]

  /* Load admin-set custom readings for today */
  useEffect(() => {
    api
      .get(`/horoscope?date=${new Date().toISOString().slice(0, 10)}`)
      .then((rows) => {
        if (Array.isArray(rows)) {
          setOverrides(Object.fromEntries(rows.map((r) => [r.zodiac_sign.toLowerCase(), r])))
        }
      })
      .catch(() => {})
  }, [])

  /* Convert vertical wheel gestures into horizontal pill scrolling.
     React's onWheel is attached as a passive listener, so preventDefault()
     there is silently ignored (page + pills scroll at once = jank). A native
     non-passive listener is the only way to actually take over the wheel. */
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault()
        el.scrollLeft += e.deltaY
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <section id="horoscope" className="section-alt">
      <div className="container">
        <div className="horo-topbar" data-reveal>
          <div className="section-head" style={{ margin: 0, maxWidth: 620, textAlign: 'left' }}>
            <div className="eyebrow">Daily Horoscope</div>
            <h2>horoscope <span>reading</span></h2>
            <p id="horoscopeDateText">
              {range === 'today'
                ? `Daily prediction for ${getReading(sign.key, range).dateFormatted} — automatically refreshed each morning.`
                : `${range.charAt(0).toUpperCase() + range.slice(1)} outlook for ${getReading(sign.key, range).dateFormatted}.`}
            </p>
          </div>
          <div className="horo-tabs" id="horoTabs">
            {RANGES.map((r) => (
              <button
                key={r.key}
                className={`horo-tab${range === r.key ? ' active' : ''}`}
                data-range={r.key}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className="horo-sign-scroll"
          id="horoSignScroll"
          ref={scrollRef}
        >
          {SIGNS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              className={`horo-pill${activeIndex === i ? ' active' : ''}`}
              onClick={() => {
                setActiveIndex(i)
                scrollRef.current?.querySelectorAll('.horo-pill')[i]?.scrollIntoView({
                  behavior: 'smooth', block: 'nearest', inline: 'center',
                })
              }}
            >
              <div className="horo-pill-avatar">
                <img src={`/images/Zodiac Signs/${s.n}.png`} alt={s.n} loading="lazy" decoding="async" />
              </div>
              <div className="horo-pill-name">{s.n}</div>
            </button>
          ))}
        </div>

        <HoroCard sign={sign} range={range} overrides={overrides} />
      </div>
    </section>
  )
}
