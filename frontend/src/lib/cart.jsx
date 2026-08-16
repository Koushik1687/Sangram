/* ==========================================================================
   cart.jsx — Shopping cart state, persisted to localStorage.
   Items store a product snapshot (id, name, price, …) plus a quantity, so the
   drawer can render anywhere without refetching. The final price is always
   re-computed server-side when the order is created.
   ========================================================================== */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { withViewTransition } from './viewTransition'

const CartContext = createContext(null)
const CART_KEY = 'ss_cart'
const MAX_QTY = 99

function loadCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY) || '[]')
    return Array.isArray(parsed)
      ? parsed.filter((it) => it && it.product && it.product.id != null && Number(it.quantity) > 0)
      : []
  } catch {
    return []
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items))
    } catch {
      /* storage unavailable — cart lives in memory only */
    }
  }, [items])

  const add = useCallback((product, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((it) => Number(it.product.id) === Number(product.id))
      if (existing) {
        return prev.map((it) =>
          Number(it.product.id) === Number(product.id)
            ? { ...it, quantity: Math.min(MAX_QTY, it.quantity + qty) }
            : it,
        )
      }
      return [...prev, { product, quantity: Math.max(1, Math.min(MAX_QTY, qty)) }]
    })
    withViewTransition(() => setIsOpen(true))
  }, [])

  const setQuantity = useCallback((productId, qty) => {
    setItems((prev) =>
      prev.map((it) =>
        Number(it.product.id) === Number(productId)
          ? { ...it, quantity: Math.max(1, Math.min(MAX_QTY, qty)) }
          : it,
      ),
    )
  }, [])

  const remove = useCallback((productId) => {
    setItems((prev) => prev.filter((it) => Number(it.product.id) !== Number(productId)))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const count = useMemo(() => items.reduce((n, it) => n + it.quantity, 0), [items])
  const subtotal = useMemo(
    () => items.reduce((n, it) => n + Number(it.product.price) * it.quantity, 0),
    [items],
  )

  const openCart = useCallback(() => withViewTransition(() => setIsOpen(true)), [])
  const closeCart = useCallback(() => withViewTransition(() => setIsOpen(false)), [])

  return (
    <CartContext.Provider
      value={{ items, count, subtotal, isOpen, add, setQuantity, remove, clear, openCart, closeCart }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within a CartProvider')
  return ctx
}
