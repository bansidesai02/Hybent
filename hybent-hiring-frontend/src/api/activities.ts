import axiosInstance from './axios'

export interface Activity {
  id: string
  action: string
  resource_type: string
  resource_id: string
  details: any
  created_at: string
  user_id: string | null
}

export const activitiesApi = {
  list: (limit = 20, resourceId?: string) => 
    axiosInstance.get<Activity[]>(`/v1/activities`, { params: { limit, resource_id: resourceId } }),
}
