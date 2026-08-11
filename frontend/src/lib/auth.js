// Token storage — sessionStorage, not localStorage: deliberate, for
// per-tab session isolation (each tab gets its own login, closing a tab
// logs it out, nothing persists across browser restarts). No refresh-token
// rotation yet. Access tokens are Supabase-issued (1hr expiry); a 401
// anywhere just bounces to /login rather than silently refreshing, since
// there's no refresh flow wired up yet. Revisit if session length becomes
// annoying.
const TOKEN_KEY = 'ila_access_token'
const USER_KEY = 'ila_user'

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setSession(token, user) {
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
}

export function getUser() {
  const raw = sessionStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

export function isAuthenticated() {
  return !!getToken()
}
