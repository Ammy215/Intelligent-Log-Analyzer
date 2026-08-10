import { createContext, useContext, useState } from 'react'
import { authAPI } from '@/lib/api'
import { getUser, setSession, clearSession, isAuthenticated } from '@/lib/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getUser())

  const login = async (email, password) => {
    const result = await authAPI.login(email, password)
    // result.user is just {id, email} — role/org_id live in the JWT's
    // app_metadata claim, not decoded here, so fetch the full profile via
    // /auth/me (needs the token, so set the session first).
    setSession(result.access_token, result.user)
    const me = await authAPI.me()
    setSession(result.access_token, me)
    setUser(me)
    return result
  }

  const signup = async (fields) => {
    return authAPI.signup(fields)
  }

  const logout = async () => {
    try {
      await authAPI.logout()
    } catch {
      // Best-effort — the session is being dropped client-side regardless.
    }
    clearSession()
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: isAuthenticated(), login, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
