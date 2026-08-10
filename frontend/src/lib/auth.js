// Token storage — plain localStorage, no refresh-token rotation yet.
// Access tokens are Supabase-issued (1hr expiry); a 401 anywhere just
// bounces to /login rather than silently refreshing, since there's no
// refresh flow wired up yet. Revisit if session length becomes annoying.
const TOKEN_KEY = 'ila_access_token'
const USER_KEY = 'ila_user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

export function isAuthenticated() {
  return !!getToken()
}
