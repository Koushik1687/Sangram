/* ==========================================================================
   BookingForm — appointment booking: chamber + date pickers, available
   time slots from the API, and submit → POST /api/bookings.
   ========================================================================== */
import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useCollection } from '../lib/data'

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null
  const m = timeStr.trim().match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM)?$/i)
  if (!m) return null
  let hours = parseInt(m[1], 10)
  const minutes = m[2] ? parseInt(m[2], 10) : 0
  const meridian = m[3] ? m[3].toUpperCase() : (hours < 8 ? 'PM' : 'AM')

  if (meridian === 'PM' && hours < 12) hours += 12
  if (meridian === 'AM' && hours === 12) hours = 0

  return hours * 60 + minutes
}

function minutesToTimeString(totalMinutes) {
  let hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const meridian = hours >= 12 ? 'PM' : 'AM'

  hours = hours % 12
  if (hours === 0) hours = 12

  const minStr = minutes === 0 ? '00' : String(minutes).padStart(2, '0')
  return `${hours}:${minStr} ${meridian}`
}

function generateSlotsFromTiming(timingStr, stepMinutes = 60) {
  const DEFAULT_SLOTS = ['11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:30 PM', '4:30 PM', '5:30 PM', '6:30 PM']
  if (!timingStr) return DEFAULT_SLOTS

  const parts = timingStr.split(/[–\-—]| to /i).map((s) => s.trim()).filter(Boolean)
  if (parts.length < 2) return DEFAULT_SLOTS

  let startMin = parseTimeToMinutes(parts[0])
  let endMin = parseTimeToMinutes(parts[1])
  if (startMin == null || endMin == null) return DEFAULT_SLOTS

  if (endMin < startMin) endMin += 12 * 60

  const slots = []
  for (let m = startMin; m <= endMin; m += stepMinutes) {
    slots.push(minutesToTimeString(m))
  }

  return slots.length > 0 ? slots : DEFAULT_SLOTS
}

const SERVICES = [
  'Horoscope Reading', 'Kundali Analysis', 'Marriage Guidance', 'Career Guidance',
  'Business Astrology', 'Gemstone Guidance', 'Vastu Guidance', 'Numerology',
]

function getWeekday(dateValue) {
  if (!dateValue) return 'Monday'
  return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(`${dateValue}T00:00:00`))
}

export default function BookingForm() {
  const chambers = useCollection('chambers')
  const [service, setService] = useState(SERVICES[0])
  const [chamberId, setChamberId] = useState('')
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState('')
  const [slotList, setSlotList] = useState([])
  const [msg, setMsg] = useState(null)

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  useEffect(() => {
    if (chambers.length && !chamberId) setChamberId(String(chambers[0].id))
  }, [chambers, chamberId])

  useEffect(() => {
    if (!date) setDate(today)
  }, [date, today])

  /* Fetch available slots whenever chamber or date changes */
  useEffect(() => {
    let live = true
    setSlot('')
    if (!chamberId || !date) return

    const curChamber = chambers.find((c) => String(c.id) === String(chamberId))
    const baseline = generateSlotsFromTiming(curChamber?.timing || curChamber?.hours)
    setSlotList(baseline.map((s) => ({ slot: s, available: true })))

    api
      .get(`/bookings/slots?chamber_id=${encodeURIComponent(chamberId)}&date=${encodeURIComponent(date)}`)
      .then((rows) => {
        if (!live || !Array.isArray(rows) || !rows.length) return
        setSlotList(rows)
      })
      .catch(() => {
        /* backend down — keep baseline slots */
      })
    return () => { live = false }
  }, [chamberId, date, chambers])

  const chamber = chambers.find((c) => String(c.id) === String(chamberId))
  const mapLocation = chamber?.locationByDay?.[getWeekday(date)] || chamber?.address || 'Kolkata'
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(mapLocation)}&output=embed`

  const [paymentMode, setPaymentMode] = useState('phonepe') // 'phonepe' or 'standard'

  function submit(e) {
    e.preventDefault()
    if (!slot) {
      setMsg({ type: 'err', text: 'Please select a time slot.' })
      return
    }
    const payload = {
      client_name: e.target.name.value,
      phone: e.target.phone.value,
      email: e.target.email.value,
      service,
      chamber_id: chamberId,
      booking_date: date,
      time_slot: slot,
      notes: e.target.notes.value,
    }

    if (paymentMode === 'phonepe') {
      // Create booking first, then initiate PhonePe payment via backend
      api
        .post('/bookings', payload)
        .then((res) => {
          return api.post('/payments/initiate', {
            amount: 500, // Standard consultation fee
            customer_name: payload.client_name,
            customer_phone: payload.phone,
            customer_email: payload.email,
            booking_id: res.id,
          })
        })
        .then((payRes) => {
          if (payRes && payRes.redirect_url) {
            window.location.href = payRes.redirect_url
          } else {
            setMsg({ type: 'ok', text: 'Booking created. Redirecting to PhonePe PG...' })
          }
        })
        .catch((err) => {
          setMsg({
            type: 'err',
            text: err.message === 'Slot already taken'
              ? 'That time slot was just booked. Please pick another.'
              : 'Could not initiate PhonePe payment. Please try again.',
          })
        })
    } else {
      api
        .post('/bookings', payload)
        .then(() => {
          setMsg({ type: 'ok', text: 'Your appointment has been booked successfully! We will confirm it shortly by phone.' })
          e.target.reset()
          setService(SERVICES[0])
          setDate(today)
          setSlot('')
          setTaken([])
        })
        .catch((err) => {
          setMsg({
            type: 'err',
            text: err.message === 'Slot already taken'
              ? 'That time slot was just booked. Please pick another.'
              : 'Could not reach the booking service. Please try again later.',
          })
        })
    }
  }

  return (
    <div className="booking-wrap">
      <div className="services-header" data-reveal>
        <div className="eyebrow">Contact</div>
        <h2>Reach out to us</h2>
        <div className="contact-stack">
          <div className="contact-item">
            <span className="contact-icon">☎</span>
            <div>
              <strong>Phone</strong>
              <span>+91 82768 42057</span>
            </div>
          </div>
          <div className="contact-item">
            <span className="contact-icon">✉</span>
            <div>
              <strong>Email</strong>
              <span>contact@sreesangram.com</span>
            </div>
          </div>
          <div className="contact-item">
            <span className="contact-icon">📍</span>
            <div>
              <strong>Main chamber</strong>
              <span>Gariahat Road, Kolkata - 700019</span>
            </div>
          </div>
        </div>
        <div className="map-box">
          <iframe id="chamberMapFrame" src={mapSrc} loading="lazy" title={`Chamber location — ${mapLocation}`}></iframe>
        </div>
      </div>

      <form className="booking-form" id="bookingForm" onSubmit={submit} data-reveal>
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="bookService">Select service</label>
            <select id="bookService" name="service" value={service} onChange={(e) => setService(e.target.value)} required>
              {SERVICES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="bookChamber">Chamber</label>
            <select id="bookChamber" name="chamber" value={chamberId} onChange={(e) => setChamberId(e.target.value)} required>
              {chambers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="bookDate">Date</label>
            <input type="date" id="bookDate" name="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="field full">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
              <label>Available time slots</label>
              {(chamber?.timing || chamber?.hours) && (
                <span style={{ fontSize: '.76rem', color: 'var(--gold-soft)', fontWeight: '500' }}>
                  Schedule: {chamber.timing || chamber.hours}
                </span>
              )}
            </div>
            <div className="slot-grid" id="slotGrid">
              {slotList.map(({ slot: s, available }) => {
                const isTaken = !available
                return (
                  <label key={s} className={`slot${isTaken ? ' taken' : ''}`}>
                    <input
                      type="radio"
                      name="slot"
                      value={s}
                      disabled={isTaken}
                      checked={slot === s}
                      onChange={() => setSlot(s)}
                      required
                    />
                    {s}
                  </label>
                )
              })}
            </div>
          </div>
          <div className="field">
            <label htmlFor="bookName">Full name</label>
            <input type="text" id="bookName" name="name" required placeholder="Your name" />
          </div>
          <div className="field">
            <label htmlFor="bookPhone">Phone number</label>
            <input type="tel" id="bookPhone" name="phone" required placeholder="+91" />
          </div>
          <div className="field full">
            <label htmlFor="bookEmail">Email</label>
            <input type="email" id="bookEmail" name="email" placeholder="you@example.com" />
          </div>
          <div className="field full">
            <label htmlFor="bookNotes">Additional information (optional)</label>
            <textarea id="bookNotes" name="notes" placeholder="Birth date, time, place, etc."></textarea>
          </div>

          <div className="field full">
            <label>Payment Method</label>
            <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="payMethod"
                  value="phonepe"
                  checked={paymentMode === 'phonepe'}
                  onChange={() => setPaymentMode('phonepe')}
                />
                Pay online via PhonePe Gateway (₹500)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="payMethod"
                  value="standard"
                  checked={paymentMode === 'standard'}
                  onChange={() => setPaymentMode('standard')}
                />
                Pay at Chamber
              </label>
            </div>
          </div>
        </div>
        <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 22 }}>
          {paymentMode === 'phonepe' ? 'Pay & Confirm via PhonePe' : 'Confirm appointment'}
        </button>
        {msg && <p className={`form-msg show ${msg.type}`}>{msg.text}</p>}
      </form>
    </div>
  )
}
