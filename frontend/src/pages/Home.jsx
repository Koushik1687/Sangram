import Loader from '../components/Loader'
import StarField from '../components/StarField'
import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import About from '../components/About'
import PlanetGuide from '../components/PlanetGuide'
import Services from '../components/Services'
import Products from '../components/Products'
import BookingForm from '../components/BookingForm'
import Chambers from '../components/Chambers'
import HoroscopeSection from '../components/HoroscopeSection'
import Blog from '../components/Blog'
import Testimonials from '../components/Testimonials'
import Gallery from '../components/Gallery'
import Footer from '../components/Footer'
import FloatingActions from '../components/FloatingActions'
import { useScrollReveal } from '../hooks/useScrollReveal'

export default function Home() {
  useScrollReveal()

  return (
    <>
      <Loader />
      <StarField />
      <div className="cosmic-wash"></div>

      <Navbar />

      <main>
        <Hero />
        <About />
        <PlanetGuide />
        <Services />
        <Products />

        <section id="booking" className="section-alt">
          <div className="container">
            <BookingForm />
          </div>
        </section>

        <Chambers />
        <HoroscopeSection />
        <Blog />
        <Testimonials />
        <Gallery />
      </main>

      <Footer />
      <FloatingActions />
    </>
  )
}
