/* ==========================================================================
   auth.jsx — Customer authentication context for the shop.
   The session is DB-backed: the JWT (stored in localStorage, as required by
   a browser SPA) is validated against /api/users/me on load, and the user
   profile is always fetched from the database. A cached profile in
   localStorage is never trusted to mark anyone as logged in.
   ========================================================================== */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  api,
  clearCustomerToken,
  getCustomerToken,
  saveCustomerToken,
} from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(getCustomerToken)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let live = true
    if (!token) {
      setReady(true)
      return undefined
    }
    api
      .get('/users/me', { customer: true })
      .then((u) => {
        if (!live) return
        setUser(u)
      })
      .catch(() => {
        if (!live) return
        clearCustomerToken()
        setToken(null)
        setUser(null)
      })
      .finally(() => {
        if (live) setReady(true)
      })
    return () => { live = false }
  }, [token])

  const login = useCallback(async (email, password) => {
    const res = await api.post('/users/login', { email, password }, { customer: true })
    saveCustomerToken(res.token)
    setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const register = useCallback(async (payload) => {
    const res = await api.post('/users/register', payload, { customer: true })
    saveCustomerToken(res.token)
    setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  /* Google sign-in: the backend verifies the ID token and logs the customer
     in (creating the account on first use — no OTP needed). */
  const googleLogin = useCallback(async (credential) => {
    const res = await api.post('/users/google', { credential }, { customer: true })
    saveCustomerToken(res.token)
    setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const logout = useCallback(() => {
    clearCustomerToken()
    setToken(null)
    setUser(null)
  }, [])

  /* Keep context in sync after a profile update. */
  const updateUser = useCallback((u) => {
    setUser(u)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, ready, login, register, googleLogin, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
