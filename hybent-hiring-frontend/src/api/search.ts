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

/* ── Global Search: own database + outside candidates ─────────────────────── */

export interface GlobalSearchFilters {
  job_titles: string[]
  skills: string[]
  city: string | null
  country: string | null
  min_years: number | null
  max_years: number | null
}

export interface OwnCandidateHit {
  id: string
  full_name: string
  job_title: string | null
  company: string | null
  location: string | null
  years_experience: number | null
  skills: string[]
  matched_skills: string[]
  pipeline_stage: string | null
  email: string
  match_score: number
  missing_skills: string[]
  match_reason: string
}

export interface OutsideCandidateHit {
  external_id: string
  full_name: string
  job_title: string | null
  company: string | null
  location: string | null
  years_experience: number | null
  skills: string[]
  matched_skills: string[]
  has_email: boolean
  has_phone: boolean
  has_linkedin: boolean
  linkedin_url: string | null
  source: 'pdl' | 'github' | 'network'
  /** GitHub results only */
  github_url?: string | null
  github_login?: string
  followers?: number
  public_repos?: number
  match_score: number
  missing_skills: string[]
  match_reason: string
}

export interface GlobalSearchResponse {
  filters: GlobalSearchFilters
  own: OwnCandidateHit[] | null
  outside: { total: number; results: OutsideCandidateHit[]; cached: boolean } | null
  outside_error: string | null
  /** Developer searches only; null when the search isn't for a tech role. */
  github: { total: number; results: OutsideCandidateHit[]; cached: boolean } | null
  github_error: string | null
  /** Hybent Talent Network members (consented). Names shortened, no contact details. */
  network: NetworkHit[] | null
}

export interface NetworkHit extends OutsideCandidateHit {
  profile_id: string
  looking_for: string | null
  /** This company's request to them, if any. */
  request_status: 'pending' | 'accepted' | 'declined' | null
  candidate_id: string | null
}

export const candidateGlobalSearch = async (body: {
  query?: string
  filters?: GlobalSearchFilters
  scope?: 'own' | 'outside' | 'both'
  job_id?: string
}): Promise<GlobalSearchResponse> => {
  const { data } = await api.post<GlobalSearchResponse>('/v1/search/global', body, { skipLoader: true })
  return data
}

export const importOutsideCandidate = async (body: { person: OutsideCandidateHit; job_id?: string }) => {
  const { data } = await api.post<{ candidate_id: string; created: boolean }>('/v1/search/global/import', body)
  return data
}

export const requestNetworkContact = async (body: { profile_id: string; job_id?: string; message?: string }) => {
  const { data } = await api.post<{ status: 'pending' }>('/v1/search/network/request', body)
  return data
}
