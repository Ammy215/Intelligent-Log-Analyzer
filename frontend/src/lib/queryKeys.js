// TanStack Query key factory
// Organized query keys for caching and invalidation

export const queryKeys = {
  // Logs
  logs: {
    all: ['logs'],
    list: (filters) => ['logs', 'list', filters],
    detail: (id) => ['logs', 'detail', id],
  },

  // Analysis
  analysis: {
    all: ['analysis'],
    summary: ['analysis', 'summary'],
    topAttackers: (limit) => ['analysis', 'top-attackers', limit],
    timeline: (interval, days) => ['analysis', 'timeline', interval, days],
    eventTypes: ['analysis', 'event-types'],
    heatmap: ['analysis', 'heatmap'],
    ipProfile: (ip) => ['analysis', 'ip-profile', ip],
  },

  // Incidents
  incidents: {
    all: ['incidents'],
    list: (filters) => ['incidents', 'list', filters],
    detail: (id) => ['incidents', 'detail', id],
  },

  // Reports
  reports: {
    all: ['reports'],
    executive: (ip) => ['reports', 'executive', ip],
    incident: (id) => ['reports', 'incident', id],
    statistics: ['reports', 'statistics'],
  },

  // Health
  health: ['health'],
}

export default queryKeys
