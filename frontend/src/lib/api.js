import axios from 'axios'
import { API_BASE_URL, API_ORIGIN } from './constants'
import { getToken, clearSession } from './auth'

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach the JWT to every request, when present. Auth endpoints
// (signup/login) don't need one and Supabase ignores an absent header
// fine, so this doesn't need to special-case them.
api.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// A 401 means the token is missing/expired/invalid — there's no refresh
// flow yet, so the only correct move is to drop the session and send the
// user back to /login. Skip this for the login endpoint itself: a wrong
// password there is a normal in-page error, not a session expiry.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.includes('/auth/login')
    if (error.response?.status === 401 && !isLoginRequest) {
      clearSession()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

// ============ LOGS API ============
export const logsAPI = {
  // Get logs with pagination and filters
  getLogs: async (params = {}) => {
    const response = await api.get('/logs', { params })
    return response.data
  },

  // Get single log by ID
  getLogById: async (logId) => {
    const response = await api.get(`/logs/${logId}`)
    return response.data
  },

  // Upload log file
  uploadLogFile: async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/logs/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  // Ingest single log entry
  ingestLog: async (logEntry) => {
    const response = await api.post('/logs/ingest', logEntry)
    return response.data
  },

  // Delete log
  deleteLog: async (logId) => {
    const response = await api.delete(`/logs/${logId}`)
    return response.data
  },
}

// ============ ANALYSIS API ============
export const analysisAPI = {
  // Get summary statistics
  getSummary: async () => {
    const response = await api.get('/analysis/summary')
    return response.data
  },

  // Get top attackers
  getTopAttackers: async (limit = 10) => {
    const response = await api.get('/analysis/top-attackers', {
      params: { limit },
    })
    return response.data
  },

  // Get attack timeline
  getTimeline: async (interval = 'hour', days = 7) => {
    const response = await api.get('/analysis/timeline', {
      params: { interval, days },
    })
    return response.data
  },

  // Get event type distribution
  getEventTypes: async () => {
    const response = await api.get('/analysis/event-types')
    return response.data
  },

  // Get attack heatmap
  getHeatmap: async () => {
    const response = await api.get('/analysis/heatmap')
    return response.data
  },

  // Analyze specific IP
  analyzeIP: async (ip) => {
    const response = await api.post(`/analysis/ip/${ip}`)
    return response.data
  },
}

// ============ INCIDENTS API ============
export const incidentsAPI = {
  // List incidents
  listIncidents: async (params = {}) => {
    const response = await api.get('/incidents', { params })
    return response.data
  },

  // Get single incident
  getIncident: async (incidentId) => {
    const response = await api.get(`/incidents/${incidentId}`)
    return response.data
  },

  // Detect new incidents
  detectIncidents: async (timeWindowMinutes = 60) => {
    const response = await api.post('/incidents/detect', null, {
      params: { time_window_minutes: timeWindowMinutes },
    })
    return response.data
  },

  // Update incident status
  updateStatus: async (incidentId, newStatus) => {
    const response = await api.patch(`/incidents/${incidentId}/status`, {
      new_status: newStatus,
    })
    return response.data
  },
}

// ============ REPORTS API ============
export const reportsAPI = {
  // Generate executive summary for IP
  generateExecutiveSummary: async (ip) => {
    const response = await api.post(`/reports/executive/${ip}`)
    return response.data
  },

  // Generate incident report
  generateIncidentReport: async (incidentId) => {
    const response = await api.post(`/reports/incident/${incidentId}`)
    return response.data
  },

  // Generate remediation plan
  generateRemediationPlan: async (threatFactors, riskLevel) => {
    const response = await api.post('/reports/remediation', null, {
      params: {
        threat_factors: threatFactors,
        risk_level: riskLevel,
      },
    })
    return response.data
  },

  // Get summary statistics report
  getSummaryStatistics: async () => {
    const response = await api.post('/reports/summary-statistics')
    return response.data
  },

  // Check report service health
  checkHealth: async () => {
    const response = await api.get('/reports/health')
    return response.data
  },
}

// ============ AUTH API ============
export const authAPI = {
  signup: async ({ email, password, orgName, fullName }) => {
    const response = await api.post('/auth/signup', {
      email,
      password,
      org_name: orgName || undefined,
      full_name: fullName || undefined,
    })
    return response.data
  },

  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password })
    return response.data
  },

  logout: async () => {
    const response = await api.post('/auth/logout')
    return response.data
  },

  setPassword: async (accessToken, newPassword) => {
    const response = await api.post('/auth/set-password', {
      access_token: accessToken,
      new_password: newPassword,
    })
    return response.data
  },

  me: async () => {
    const response = await api.get('/auth/me')
    return response.data
  },
}

// ============ BILLING API ============
export const billingAPI = {
  getCredits: async () => {
    const response = await api.get('/billing/credits')
    return response.data
  },

  checkout: async () => {
    const response = await api.post('/billing/checkout')
    return response.data
  },
}

// ============ ADMIN API ============
export const adminAPI = {
  listMembers: async () => {
    const response = await api.get('/admin/members')
    return response.data
  },

  listAuditLog: async () => {
    const response = await api.get('/admin/audit-log')
    return response.data
  },

  listDetectionRules: async () => {
    const response = await api.get('/admin/detection-rules')
    return response.data
  },

  updateDetectionRule: async (ruleId, weight) => {
    const response = await api.patch(`/admin/detection-rules/${ruleId}`, { weight })
    return response.data
  },

  getCreditsLedger: async () => {
    const response = await api.get('/admin/credits-ledger')
    return response.data
  },
}

// ============ SUPER ADMIN API (platform-level, not org-scoped) ============
export const superadminAPI = {
  listOrganizations: async () => {
    const response = await api.get('/superadmin/organizations')
    return response.data
  },

  listUsers: async () => {
    const response = await api.get('/superadmin/users')
    return response.data
  },

  getStats: async () => {
    const response = await api.get('/superadmin/stats')
    return response.data
  },

  getOrganization: async (orgId) => {
    const response = await api.get(`/superadmin/organizations/${orgId}`)
    return response.data
  },

  adjustCredits: async (orgId, delta, reason) => {
    const response = await api.patch(`/superadmin/organizations/${orgId}/credits`, { delta, reason })
    return response.data
  },

  changeUserRole: async (userId, role) => {
    const response = await api.patch(`/superadmin/users/${userId}/role`, { role })
    return response.data
  },
}

// ============ HEALTH CHECK ============
export const healthAPI = {
  // Check API health
  checkHealth: async () => {
    // /health sits outside the /api/v1 prefix, so it overrides baseURL with
    // the bare origin rather than hardcoding a host.
    const response = await api.get('/health', {
      baseURL: API_ORIGIN,
    })
    return response.data
  },
}

export default api
