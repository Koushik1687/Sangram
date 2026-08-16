/* ==========================================================================
   auth.jsx — Customer authentication context for the shop.
   Session is persisted in localStorage and validated against /api/users/me
   on load so stale tokens are cleared automatically.
   ========================================================================== */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  api,
  clearCustomerToken,
  getCustomerToken,
  getCustomerUser,
  saveCustomerToken,
  saveCustomerUser,
} from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getCustomerUser)
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
        saveCustomerUser(u)
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
    saveCustomerUser(res.user)
    setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const register = useCallback(async (payload) => {
    const res = await api.post('/users/register', payload, { customer: true })
    saveCustomerToken(res.token)
    saveCustomerUser(res.user)
    setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const logout = useCallback(() => {
    clearCustomerToken()
    setToken(null)
    setUser(null)
  }, [])

  /* Keep context + localStorage in sync after a profile update. */
  const updateUser = useCallback((u) => {
    setUser(u)
    saveCustomerUser(u)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, ready, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
