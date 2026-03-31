import { apiGet } from '../client'

// Placeholder — backend endpoints not yet implemented
export const dashboardApi = {
  stats: () => apiGet('/dashboard/stats'),
  activities: () => apiGet('/dashboard/activities'),
  risks: () => apiGet('/dashboard/risks'),
}
