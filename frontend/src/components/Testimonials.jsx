import { useEffect, useRef, useState } from 'react'
import { useCollection } from '../lib/data'

export default function Testimonials() {
  const list = useCollection('testimonials')
  const [idx, setIdx] = useState(0)
  const sliderRef = useRef(null)
  const count = list.length

  useEffect(() => {
    if (count === 0) return
    const slider = sliderRef.current
    const timer = setInterval(() => setIdx((i) => (i + 1) % count), 6000)
    const pause = () => clearInterval(timer)
    const resume = () => { /* restart interval via effect re-run is enough */ }
    slider?.addEventListener('mouseenter', pause)
    slider?.addEventListener('mouseleave', resume)
    return () => {
      clearInterval(timer)
      slider?.removeEventListener('mouseenter', pause)
      slider?.removeEventListener('mouseleave', resume)
    }
  }, [count])

  if (count === 0) return null

  return (
    <section id="testimonials" className="section-alt">
      <div className="container">
        <div className="section-head center" data-reveal>
          <div className="eyebrow" style={{ justifyContent: 'center' }}>Testimonials</div>
          <h2>What clients say</h2>
        </div>
        <div className="testi-slider" data-reveal ref={sliderRef}>
          <div className="testi-track" id="testiTrack" style={{ transform: `translateX(-${idx * 100}%)` }}>
            {list.map((t) => (
              <div className="testi-slide" key={t.id}>
                <div className="testi-card">
                  <div className="stars">{'★'.repeat(t.rating)}{'☆'.repeat(5 - t.rating)}</div>
                  <p>“{t.text}”</p>
                  <div className="testi-name">{t.name}</div>
                  <div className="testi-role">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="testi-dots" id="testiDots">
            {list.map((_, i) => (
              <button key={i} data-i={i} className={i === idx ? 'active' : ''} onClick={() => setIdx(i)}></button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
