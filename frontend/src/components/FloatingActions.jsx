import { useEffect, useState } from 'react'

export default function FloatingActions() {
  const [showTop, setShowTop] = useState(false)

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <a
        href="https://wa.me/919830000000"
        className="whatsapp-fab"
        target="_blank"
        rel="noopener"
        aria-label="WhatsApp"
      >
        ☎
      </a>
      <button
        id="back-to-top"
        className={showTop ? 'show' : ''}
        aria-label="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        ↑
      </button>
    </>
  )
}
