/* ==========================================================================
   routes/schemas.js — shared Zod schemas used by the @hono/zod-openapi
   route definitions. Response schemas are passthrough + optional so they
   document the API without failing on extra/nullable DB columns.
   ========================================================================== */
import { z } from '@hono/zod-openapi'
import { OpenAPIHono } from '@hono/zod-openapi'

/* ---------- App factory ---------- */
export function createApp() {
  return new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) return c.json({ error: 'Missing required fields' }, 400)
    },
  })
}

/* ---------- Common ---------- */
export const ErrorSchema = z.object({ error: z.string() }).openapi('Error')
export const SuccessSchema = z.object({ success: z.boolean() }).openapi('Success')
export const MessageSchema = z.object({
  id: z.number().openapi({ example: 1 }),
  message: z.string().openapi({ example: 'Booking confirmed' }),
}).openapi('Message')

/* ---------- Customer Auth ---------- */
export const CustomerRegisterInput = z.object({
  name: z.string().min(2).openapi({ example: 'Rahul Sharma' }),
  email: z.string().email().openapi({ example: 'rahul@example.com' }),
  phone: z.string().optional().openapi({ example: '9999999999' }),
  password: z.string().min(6).openapi({ example: 'secret123' }),
}).openapi('CustomerRegisterInput')

export const CustomerLoginInput = z.object({
  email: z.string().email().openapi({ example: 'rahul@example.com' }),
  password: z.string().openapi({ example: 'secret123' }),
}).openapi('CustomerLoginInput')

export const CustomerSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable().optional(),
  photo_url: z.string().nullable().optional(),
  age: z.number().nullable().optional(),
  zodiac_sign: z.string().nullable().optional(),
  created_at: z.string().optional(),
}).passthrough().openapi('Customer')

export const CustomerAuthResponse = z.object({
  token: z.string(),
  user: CustomerSchema,
}).openapi('CustomerAuthResponse')

export const CustomerProfileUpdateInput = z.object({
  name: z.string().min(2).optional().openapi({ example: 'Rahul Sharma' }),
  phone: z.string().optional().openapi({ example: '9999999999' }),
  age: z.number().int().min(1).max(120).nullable().optional().openapi({ example: 32 }),
  zodiac_sign: z.string().nullable().optional().openapi({ example: 'Leo' }),
}).openapi('CustomerProfileUpdateInput')

export const CustomerPasswordInput = z.object({
  current_password: z.string().openapi({ example: 'secret123' }),
  new_password: z.string().min(6).openapi({ example: 'newsecret123' }),
}).openapi('CustomerPasswordInput')

export const CustomerPhotoInput = z.object({
  photo: z.instanceof(File).optional().openapi({ type: 'string', format: 'binary' }),
}).openapi('CustomerPhotoInput')

/* ---------- Coupons ---------- */
export const CouponSchema = z.object({
  id: z.number(),
  code: z.string(),
  discount_type: z.string(),
  discount_value: z.number(),
  min_order_amount: z.number().nullable().optional(),
  max_discount: z.number().nullable().optional(),
  valid_until: z.string().nullable().optional(),
  usage_limit: z.number().optional(),
  used_count: z.number().optional(),
  is_active: z.number().optional(),
  created_at: z.string().optional(),
}).passthrough().openapi('Coupon')

export const CouponInput = z.object({
  code: z.string().min(2).openapi({ example: 'WELCOME10' }),
  discount_type: z.enum(['percent', 'flat']).openapi({ example: 'percent' }),
  discount_value: z.number().positive().openapi({ example: 10 }),
  min_order_amount: z.number().min(0).optional().openapi({ example: 500 }),
  max_discount: z.number().positive().optional().openapi({ example: 500 }),
  valid_until: z.string().optional().openapi({ example: '2027-12-31' }),
  usage_limit: z.number().int().min(0).optional().openapi({ example: 100 }),
  is_active: z.number().int().optional().openapi({ example: 1 }),
}).openapi('CouponInput')

export const ValidateCouponInput = z.object({
  code: z.string().openapi({ example: 'WELCOME10' }),
  amount: z.number().positive().openapi({ example: 1200 }),
}).openapi('ValidateCouponInput')

export const ValidateCouponResponse = z.object({
  valid: z.boolean(),
  discount: z.number(),
  message: z.string().optional(),
  coupon: CouponSchema.optional(),
}).openapi('ValidateCouponResponse')

/* ---------- Orders ---------- */
export const OrderItemInput = z.object({
  product_id: z.number().openapi({ example: 1 }),
  quantity: z.number().int().min(1).default(1).openapi({ example: 1 }),
}).openapi('OrderItemInput')

export const OrderInput = z.object({
  items: z.array(OrderItemInput).min(1),
  address: z.string().optional().openapi({ example: '12 Lake Road, Kolkata - 700019' }),
  coupon_code: z.string().optional().openapi({ example: 'WELCOME10' }),
}).openapi('OrderInput')

export const OrderStatusInput = z.object({
  status: z.enum(['CANCELLED', 'REFUNDED']).openapi({ example: 'CANCELLED' }),
}).openapi('OrderStatusInput')

export const OrderItemSchema = z.object({
  id: z.number(),
  order_id: z.number(),
  product_id: z.number().nullable().optional(),
  product_name: z.string(),
  price: z.number(),
  quantity: z.number(),
}).passthrough().openapi('OrderItem')

export const OrderSchema = z.object({
  id: z.number(),
  order_number: z.string(),
  user_id: z.number(),
  total: z.number(),
  status: z.string(),
  address: z.string().nullable().optional(),
  discount: z.number().nullable().optional(),
  coupon_code: z.string().nullable().optional(),
  shipping_fee: z.number().nullable().optional(),
  created_at: z.string().optional(),
  items: z.array(OrderItemSchema).optional(),
}).passthrough().openapi('Order')

/* ---------- Shipping ---------- */
export const ShippingConfigResponse = z.object({
  fee: z.number().openapi({ example: 49, description: 'Flat shipping fee in ₹; 0 = free shipping always' }),
  free_shipping_min: z.number().openapi({ example: 999, description: 'Orders at/above this subtotal ship free; 0 = no free-shipping threshold' }),
}).openapi('ShippingConfigResponse')

/* ---------- Auth ---------- */
export const LoginInput = z.object({
  username: z.string().openapi({ example: 'admin' }),
  password: z.string().openapi({ example: 'admin123' }),
}).openapi('LoginInput')
export const LoginResponse = z.object({
  token: z.string().openapi({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…' }),
}).openapi('LoginResponse')

/* ---------- Products ---------- */
export const ProductSchema = z.object({
  id: z.number(),
  name: z.string(),
  category: z.string().nullable().optional(),
  price: z.number(),
  description: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  stock: z.number().nullable().optional(),
  low_stock_threshold: z.number().nullable().optional(),
  low_stock_alerted: z.number().optional(),
  is_active: z.number().optional(),
  created_at: z.string().optional(),
}).passthrough().openapi('Product')

export const ProductInput = z.object({
  name: z.string().openapi({ example: 'Blue Sapphire' }),
  category: z.string().openapi({ example: 'Gemstone' }),
  price: z.number().openapi({ example: 4500 }),
  description: z.string().optional(),
  image_url: z.string().optional(),
  stock: z.number().int().min(0).nullable().optional().openapi({ example: 10, description: 'Units available; null = unlimited' }),
  low_stock_threshold: z.number().int().min(0).nullable().optional().openapi({ example: 5, description: 'Alert admin when stock drops to this; null = global default (LOW_STOCK_THRESHOLD), 0 = off' }),
}).openapi('ProductInput')

export const ProductImageInput = z.object({
  image: z.instanceof(File).optional().openapi({ type: 'string', format: 'binary' }),
}).openapi('ProductImageInput')

/* ---------- Blogs ---------- */
export const BlogSchema = z.object({
  id: z.number(),
  title: z.string(),
  category: z.string().nullable().optional(),
  excerpt: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  featured_image: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  created_at: z.string().optional(),
}).passthrough().openapi('Blog')

export const BlogInput = z.object({
  title: z.string().openapi({ example: 'Saturn Sade Sati: preparation is key' }),
  category: z.string().openapi({ example: 'Astrology' }),
  excerpt: z.string().optional(),
  content: z.string().optional(),
  featured_image: z.string().optional(),
  published_at: z.string().optional().openapi({ example: '2026-07-18' }),
}).openapi('BlogInput')

/* ---------- Chambers ---------- */
export const ChamberSchema = z.object({
  id: z.number(),
  name: z.string(),
  address: z.string(),
  consultation_days: z.string().nullable().optional(),
  timing: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  map_url: z.string().nullable().optional(),
}).passthrough().openapi('Chamber')

export const ChamberInput = z.object({
  name: z.string().openapi({ example: 'Kolkata Main Chamber' }),
  address: z.string().openapi({ example: 'Gariahat Road, Kolkata - 700019' }),
  consultation_days: z.string().optional().openapi({ example: 'Mon – Sat' }),
  timing: z.string().optional().openapi({ example: '11:00 AM – 7:00 PM' }),
  phone: z.string().optional().openapi({ example: '+91 98300 00000' }),
  map_url: z.string().optional(),
}).openapi('ChamberInput')

/* ---------- Horoscope ---------- */
export const HoroscopeOverrideSchema = z.object({
  id: z.number(),
  zodiac_sign: z.string(),
  reading_date: z.string(),
  message: z.string().nullable().optional(),
  lucky_color: z.string().nullable().optional(),
  lucky_number: z.string().nullable().optional(),
  mood: z.string().nullable().optional(),
}).passthrough().openapi('HoroscopeOverride')

export const HoroscopeOverrideInput = z.object({
  reading_date: z.string().openapi({ example: '2026-08-13' }),
  message: z.string().openapi({ example: 'A favourable day for teamwork.' }),
  lucky_color: z.string().openapi({ example: 'Gold' }),
  lucky_number: z.string().openapi({ example: '7' }),
  mood: z.string().openapi({ example: 'Calm' }),
}).openapi('HoroscopeOverrideInput')

/* ---------- Bookings ---------- */
export const BookingSchema = z.object({
  id: z.number(),
  client_name: z.string(),
  phone: z.string(),
  email: z.string().nullable().optional(),
  service: z.string(),
  chamber_id: z.number().nullable().optional(),
  chamber_name: z.string().nullable().optional(),
  booking_date: z.string(),
  time_slot: z.string(),
  notes: z.string().nullable().optional(),
  status: z.string().optional(),
  created_at: z.string().optional(),
}).passthrough().openapi('Booking')

export const BookingInput = z.object({
  client_name: z.string().openapi({ example: 'Rahul Sharma' }),
  phone: z.string().openapi({ example: '+91 98765 43210' }),
  email: z.string().email().optional().openapi({ example: 'rahul@example.com' }),
  service: z.string().openapi({ example: 'Kundali Analysis' }),
  chamber_id: z.number().openapi({ example: 1 }),
  booking_date: z.string().openapi({ example: '2026-08-13' }),
  time_slot: z.string().openapi({ example: '11:00 AM' }),
  notes: z.string().optional(),
}).openapi('BookingInput')

export const SlotSchema = z.object({
  slot: z.string().openapi({ example: '11:00 AM' }),
  available: z.boolean().openapi({ example: true }),
}).openapi('Slot')

export const StatusInput = z.object({
  status: z.enum(['Pending', 'Confirmed', 'Cancelled']),
}).openapi('StatusInput')

/* ---------- Testimonials ---------- */
export const TestimonialSchema = z.object({
  id: z.number(),
  client_name: z.string(),
  role_location: z.string().nullable().optional(),
  rating: z.number().nullable().optional(),
  message: z.string(),
  is_approved: z.number().optional(),
}).passthrough().openapi('Testimonial')

export const TestimonialInput = z.object({
  client_name: z.string().openapi({ example: 'Sumita Banerjee' }),
  role_location: z.string().optional().openapi({ example: 'Kolkata' }),
  rating: z.number().int().min(1).max(5).optional().openapi({ example: 5 }),
  message: z.string().openapi({ example: 'The analysis was precise and deeply reassuring.' }),
}).openapi('TestimonialInput')

/* ---------- Gallery ---------- */
export const GalleryItemSchema = z.object({
  id: z.number(),
  label: z.string().nullable().optional(),
  image_url: z.string(),
  category: z.string().nullable().optional(),
  uploaded_at: z.string().optional(),
}).passthrough().openapi('GalleryItem')

export const GalleryInput = z.object({
  label: z.string().openapi({ example: 'Seminar 2026' }),
  category: z.string().optional().openapi({ example: 'Events' }),
  image: z.instanceof(File).optional().openapi({ type: 'string', format: 'binary' }),
}).openapi('GalleryInput')

/* ---------- Enquiries ---------- */
export const EnquirySchema = z.object({
  id: z.number(),
  name: z.string(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  message: z.string(),
  created_at: z.string().optional(),
  is_read: z.number().optional(),
}).passthrough().openapi('Enquiry')

export const EnquiryInput = z.object({
  name: z.string().openapi({ example: 'Priya Sen' }),
  phone: z.string().optional().openapi({ example: '+91 90000 00000' }),
  email: z.string().email().optional().openapi({ example: 'priya@example.com' }),
  message: z.string().openapi({ example: 'I would like to book a consultation.' }),
}).openapi('EnquiryInput')

/* ---------- Payments (PhonePe SDK) ---------- */
export const InitiatePaymentInput = z.object({
  amount: z.number().positive().openapi({ example: 1200 }),
  customer_name: z.string().optional().openapi({ example: 'Rahul Sharma' }),
  customer_phone: z.string().optional().openapi({ example: '9999999999' }),
  customer_email: z.string().email().optional().openapi({ example: 'rahul@example.com' }),
  booking_id: z.number().optional().openapi({ example: 1 }),
  product_id: z.number().optional().openapi({ example: 2 }),
  order_id: z.number().optional().openapi({ example: 1 }),
  redirect_url: z.string().optional().openapi({ example: 'http://localhost:5173/payment-status' }),
}).openapi('InitiatePaymentInput')

export const InitiatePaymentResponse = z.object({
  merchant_order_id: z.string(),
  redirect_url: z.string().optional(),
  status: z.string(),
  message: z.string().optional(),
}).openapi('InitiatePaymentResponse')

export const PaymentRecordSchema = z.object({
  id: z.number(),
  merchant_order_id: z.string(),
  amount: z.number(),
  status: z.string(),
  customer_name: z.string().nullable().optional(),
  customer_phone: z.string().nullable().optional(),
  customer_email: z.string().nullable().optional(),
  booking_id: z.number().nullable().optional(),
  product_id: z.number().nullable().optional(),
  order_id: z.number().nullable().optional(),
  phonepe_transaction_id: z.string().nullable().optional(),
  response_code: z.string().nullable().optional(),
  created_at: z.string().optional(),
}).passthrough().openapi('PaymentRecord')

export const RefundInput = z.object({
  merchant_order_id: z.string().openapi({ example: 'ORD1700000000000' }),
  amount: z.number().positive().openapi({ example: 500 }),
}).openapi('RefundInput')

