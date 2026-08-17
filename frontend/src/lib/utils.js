import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { SEVERITY_COLORS, getCountryFlag } from './constants'

// Tailwind class merging utility
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// Format timestamp to human-readable format
export function formatTimestamp(timestamp) {
  if (!timestamp) return 'N/A'
  try {
    const date = typeof timestamp === 'string' ? parseISO(timestamp) : new Date(timestamp)
    return format(date, 'MMM dd, yyyy HH:mm:ss')
  } catch (e) {
    return 'Invalid date'
  }
}

// Format timestamp to relative time (e.g., "2 hours ago")
export function formatRelativeTime(timestamp) {
  if (!timestamp) return 'N/A'
  try {
    const date = typeof timestamp === 'string' ? parseISO(timestamp) : new Date(timestamp)
    return formatDistanceToNow(date, { addSuffix: true })
  } catch (e) {
    return 'Invalid date'
  }
}

// Format IP address (ensure monospace rendering)
export function formatIP(ip) {
  if (!ip) return 'N/A'
  return ip
}

// Get severity badge styles
export function getSeverityColor(severity) {
  return SEVERITY_COLORS[severity] || SEVERITY_COLORS.LOW
}

// Get threat score color based on value
export function getThreatScoreColor(score) {
  if (score >= 70) return '#ff3366' // CRITICAL - red
  if (score >= 45) return '#ffb800' // HIGH - amber
  if (score >= 20) return '#00d4ff' // MEDIUM - cyan
  return '#00ff88' // LOW/SAFE - green
}

// Format large numbers with commas
export function formatNumber(num) {
  if (num === null || num === undefined) return '0'
  return num.toLocaleString()
}

// Truncate text with ellipsis
export function truncate(text, maxLength = 50) {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// Copy text to clipboard
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    console.error('Failed to copy:', err)
    return false
  }
}

// Get country flag emoji
export { getCountryFlag }

// Calculate percentage
export function calculatePercentage(value, total) {
  if (!total || total === 0) return 0
  return Math.round((value / total) * 100)
}

// Format bytes to human-readable size
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

// Debounce function for search inputs
export function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// Extract error message from error object
export function getErrorMessage(error) {
  if (error.response?.data?.detail) {
    return error.response.data.detail
  }
  if (error.message) {
    return error.message
  }
  return 'An unexpected error occurred'
}

// Sleep utility for async operations
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// IPInfo doesn't return a full country name, so the backend stores the same
// 2-letter code in both `country` and `country_code` (see
// threat_intel/geolocation_client.py). Resolve it to something readable at
// display time — Intl.DisplayNames is built into the browser.
let _regionNames
try {
  _regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
} catch {
  _regionNames = null
}

export function countryDisplayName(code, fallback) {
  if (code && code.length === 2 && _regionNames) {
    try {
      const name = _regionNames.of(code.toUpperCase())
      // .of() echoes the input back for codes it doesn't recognise
      if (name && name.toUpperCase() !== code.toUpperCase()) return name
    } catch {
      /* unknown region code — fall through */
    }
  }
  // Only prefer the passed-in name if it adds something the code doesn't
  if (fallback && fallback.toUpperCase() !== (code || '').toUpperCase()) return fallback
  return code || fallback || null
}
