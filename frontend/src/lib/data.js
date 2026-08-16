/* ==========================================================================
   data.js — Data access for the public site.
   Tries the Express API (/api/*) first and falls back to the local default
   datasets (ported from the original static site) so the UI still renders
   when the backend is not running.
   ========================================================================== */
import { useEffect, useState } from 'react'
import { api, API_BASE } from './api'

export const API_ORIGIN = API_BASE

const DEFAULTS = {
  products: [
    { id: 'p1', name: 'Blue Sapphire', price: 4500, category: 'Gemstone', desc: 'Certified Saturn gemstone set in a silver ring, weighing 5 ratti.', img: '' },
    { id: 'p2', name: '5 Mukhi Rudraksha Mala', price: 950, category: 'Spiritual', desc: 'Authentic Nepali rudraksha mala with 108 beads, sanctified and ready for prayer.', img: '' },
    { id: 'p3', name: 'Sri Yantra', price: 1800, category: 'Yantra', desc: 'An octagonal Sri Yantra designed to attract wealth and abundance.', img: '' },
    { id: 'p4', name: 'Personal Kundali Report', price: 1200, category: 'Report', desc: '30+ page detailed birth chart analysis delivered as a PDF report.', img: '' },
    { id: 'p5', name: 'Yellow Sapphire', price: 5200, category: 'Gemstone', desc: 'Certified Jupiter gemstone set in a gold ring for prosperity and growth.', img: '' },
    { id: 'p6', name: 'Vastu Compass Set', price: 650, category: 'Vastu', desc: 'Premium directional guide for accurate home and workplace alignment.', img: '' },
  ],
  blogs: [
    { id: 'b1', title: 'Saturn Sade Sati: Fear is not the answer, preparation is', category: 'Astrology', date: '2026-07-18', desc: 'A practical guide to common myths and remedies related to Saturn’s sade sati cycle.' },
    { id: 'b2', title: 'The real impact of Rahu and Ketu in kundali', category: 'Kundli', date: '2026-07-05', desc: 'An in-depth explanation of how Rahu and Ketu influence key life areas.' },
    { id: 'b3', title: 'Why planetary matching matters in marriage', category: 'Marriage', date: '2026-06-22', desc: 'A thoughtful discussion on Ashtakoot matching and its relevance in modern life.' },
  ],
  chambers: [
    {
      id: 'c1', name: 'Kolkata Main Chamber', address: 'Gariahat Road, Kolkata - 700019',
      days: 'Mon – Sat', hours: '11:00 AM – 7:00 PM', phone: '+91 98300 00000',
      locationByDay: { Monday: 'Gariahat Road, Kolkata - 700019' },
    },
    {
      id: 'c2', name: 'Salt Lake Chamber', address: 'Sector 5, Salt Lake, Kolkata - 700091',
      days: 'Tue, Thu, Sat', hours: '12:00 PM – 6:00 PM', phone: '+91 98300 11111',
      locationByDay: { Tuesday: 'Sector 5, Salt Lake, Kolkata - 700091' },
    },
    {
      id: 'c3', name: 'Howrah Chamber', address: 'GT Road, Howrah - 711101',
      days: 'Wed, Sun', hours: '10:00 AM – 2:00 PM', phone: '+91 98300 22222',
      locationByDay: { Wednesday: 'GT Road, Howrah - 711101' },
    },
  ],
  testimonials: [
    { id: 't1', name: 'Sumita Banerjee', role: 'Kolkata', rating: 5, text: 'The guidance from Sri Sangram brought a remarkable shift in my career. The analysis was precise, thoughtful, and deeply reassuring.' },
    { id: 't2', name: 'Arijit Das', role: 'Durgapur', rating: 5, text: 'The kundali analysis was extremely detailed and accurate, and each prediction matched reality. I am deeply grateful.' },
    { id: 't3', name: 'Piyali Sengupta', role: 'Siliguri', rating: 5, text: 'I came for marriage guidance, and the insight and suggestions helped our family find direction and peace.' },
  ],
  gallery: [
    { id: 'g1', label: 'Seminar 2026' }, { id: 'g2', label: 'Temple Visit' },
    { id: 'g3', label: 'Client Session' }, { id: 'g4', label: 'Certificate' },
    { id: 'g5', label: 'Workshop' }, { id: 'g6', label: 'Award Ceremony' },
    { id: 'g7', label: 'Media Interview' }, { id: 'g8', label: 'Annual Puja' },
  ],
}

/* Map the API's snake_case rows onto the field names the UI components use. */
function normalize(entity, item) {
  switch (entity) {
    case 'products':
      return { ...item, desc: item.description ?? item.desc, img: item.image_url ?? '' }
    case 'blogs':
      return { ...item, date: item.published_at ?? item.date, desc: item.excerpt ?? item.desc }
    case 'chambers':
      return { ...item, days: item.consultation_days ?? item.days, hours: item.timing ?? item.hours }
    case 'testimonials':
      return { ...item, name: item.client_name ?? item.name, role: item.role_location ?? item.role, text: item.message ?? item.text }
    default:
      return item
  }
}

export function imageUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//.test(url) || url.startsWith('data:')) return url
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`
}

export async function fetchCollection(entity) {
  try {
    const rows = await api.get(`/${entity}`)
    if (Array.isArray(rows)) return rows.map((r) => normalize(entity, r))
  } catch {
    /* backend unavailable — fall through to local defaults */
  }
  return DEFAULTS[entity] ?? []
}

/** Loads a collection from the API (or the local defaults) once. */
export function useCollection(entity) {
  const [data, setData] = useState([])
  useEffect(() => {
    let live = true
    fetchCollection(entity).then((rows) => {
      if (live) setData(rows)
    })
    return () => { live = false }
  }, [entity])
  return data
}
