import api from './axios'
import type { SearchResults } from '@/types'

/**
 * Global search across candidates, jobs, interviews, and users.
 * 
 * @param query - The search term
 * @param limit - Max results per entity type (default 5)
 */
export const globalSearch = async (query: string, limit = 5): Promise<SearchResults> => {
  const { data } = await api.get<SearchResults>('/v1/search', {
    params: { q: query, limit },
    skipLoader: true, // Don't show global loader for search suggestions
  })
  return data
}
