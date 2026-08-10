// Design system constants
export const COLORS = {
  bg: {
    primary: '#050d1a',
    secondary: '#0a1628',
    tertiary: '#0f1e35',
    border: '#1a2d4a',
    input: '#0d1e38',
  },
  accent: {
    cyan: '#00d4ff',
    green: '#00ff88',
    amber: '#ffb800',
    red: '#ff3366',
    purple: '#8b5cf6',
  },
  text: {
    primary: '#e2e8f0',
    secondary: '#64748b',
    muted: '#334155',
  },
}

// Severity mappings
export const SEVERITY_COLORS = {
  CRITICAL: {
    bg: 'rgba(255, 51, 102, 0.12)',
    text: '#ff3366',
    border: 'rgba(255, 51, 102, 0.25)',
  },
  HIGH: {
    bg: 'rgba(255, 184, 0, 0.12)',
    text: '#ffb800',
    border: 'rgba(255, 184, 0, 0.25)',
  },
  MEDIUM: {
    bg: 'rgba(0, 212, 255, 0.12)',
    text: '#00d4ff',
    border: 'rgba(0, 212, 255, 0.25)',
  },
  LOW: {
    bg: 'rgba(100, 116, 139, 0.12)',
    text: '#94a3b8',
    border: 'rgba(100, 116, 139, 0.25)',
  },
  SAFE: {
    bg: 'rgba(0, 255, 136, 0.12)',
    text: '#00ff88',
    border: 'rgba(0, 255, 136, 0.25)',
  },
}

// Status colors for incidents
export const STATUS_COLORS = {
  open: {
    bg: 'rgba(255, 51, 102, 0.12)',
    text: '#ff3366',
    border: 'rgba(255, 51, 102, 0.25)',
  },
  investigating: {
    bg: 'rgba(255, 184, 0, 0.12)',
    text: '#ffb800',
    border: 'rgba(255, 184, 0, 0.25)',
  },
  closed: {
    bg: 'rgba(0, 255, 136, 0.12)',
    text: '#00ff88',
    border: 'rgba(0, 255, 136, 0.25)',
  },
}

// API configuration
export const API_BASE_URL = 'http://localhost:8000/api/v1'

// Chart colors
export const CHART_COLORS = {
  CRITICAL: '#ff3366',
  HIGH: '#ffb800',
  MEDIUM: '#00d4ff',
  LOW: '#94a3b8',
  primary: '#00d4ff',
  secondary: '#8b5cf6',
}

// Refresh intervals (ms)
export const REFRESH_INTERVALS = {
  LIVE_FEED: 5000,      // 5 seconds
  OVERVIEW: 30000,      // 30 seconds
  INCIDENTS: 60000,     // 1 minute
  STATS: 30000,         // 30 seconds
}

// Event type icons mapping (for future use)
export const EVENT_TYPE_ICONS = {
  failed_login: '🔐',
  brute_force: '🔨',
  port_scan: '🔍',
  sql_injection: '💉',
  xss: '⚠️',
  directory_traversal: '📁',
  invalid_user: '👤',
  root_login_attempt: '🔑',
}

// Country code to flag emoji mapping (simplified)
export const getCountryFlag = (countryCode) => {
  if (!countryCode || countryCode.length !== 2) return '🏳️'
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt())
  return String.fromCodePoint(...codePoints)
}

// Threat score ranges
export const THREAT_RANGES = {
  SAFE: [0, 20],
  SUSPICIOUS: [20, 45],
  HIGH_RISK: [45, 70],
  CRITICAL: [70, 100],
}
