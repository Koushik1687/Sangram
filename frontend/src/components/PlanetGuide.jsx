import { useRef } from 'react'
import { usePauseAnimWhenHidden } from '../hooks/usePauseAnimWhenHidden'

const PLANETS = [
  { orb: 'sun', name: 'Sun', desc: 'Core identity, ego, and life purpose.' },
  { orb: 'moon', name: 'Moon', desc: 'Inner emotions, instincts, and the subconscious.' },
  { orb: 'mercury', name: 'Mercury', desc: 'Communication, intellect, and travel.' },
  { orb: 'venus', name: 'Venus', desc: 'Love, beauty, relationships, and money.' },
  { orb: 'mars', name: 'Mars', desc: 'Action, drive, passion, and aggression.' },
  { orb: 'jupiter', name: 'Jupiter', desc: 'Luck, growth, wisdom, and expansion.' },
  { orb: 'saturn', name: 'Saturn', desc: 'Discipline, rules, karma, and limitations.' },
  { orb: 'uranus', name: 'Uranus', desc: 'Sudden change, innovation, and rebellion.' },
  { orb: 'neptune', name: 'Neptune', desc: 'Dreams, spirituality, and illusions.' },
]

export default function PlanetGuide() {
  const sectionRef = useRef(null)

  /* Pause the floating planet orbs while the section is off-screen. */
  usePauseAnimWhenHidden(sectionRef)

  return (
    <section id="planet-guide" className="planet-section" ref={sectionRef}>
      <div className="container">
        <div className="section-head center" data-reveal>
          <div className="eyebrow" style={{ justifyContent: 'center' }}>Planetary wisdom</div>
          <h2>Understand the planets</h2>
          <p>Each planet reveals a different force shaping your personality, choices, and life path.</p>
        </div>
        <div className="planet-grid">
          {PLANETS.map((p) => (
            <article className="planet-card" key={p.name} data-reveal>
              <span className={`planet-orb ${p.orb}`}></span>
              <h3>{p.name}</h3>
              <p>{p.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
