import api from './axios'
import type { Job } from '@/types'

export interface DesignationItem extends Job {
  candidate_count?: number
}

export interface DesignationsResponse {
  items: DesignationItem[]
  designation_counts: Record<string, number>
  total_candidates: number
}

export const designationsApi = {
  list: () => api.get<DesignationsResponse>('/v1/designations'),
  order: () => api.get<Array<{ designation_id: string; display_order: number }>>('/v1/designations/order'),
  reorder: (designation_ids: string[]) =>
    api.put<DesignationsResponse>('/v1/designations/reorder', { designation_ids }),
}
