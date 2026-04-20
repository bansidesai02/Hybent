import type { Interview } from '@/types'

export interface GroupedCandidate {
  candidate_id: string
  candidate_name: string
  interviews: Interview[]
}

/**
 * Groups a flat list of interviews by candidate_id.
 * Maintains chronological order of interviews within each group if the input is sorted.
 */
export function groupInterviewsByCandidate(interviews: Interview[]): GroupedCandidate[] {
  const groups: Record<string, GroupedCandidate> = {}
  const order: string[] = []

  interviews.forEach((i) => {
    const cid = i.candidate_id || 'unknown'
    if (!groups[cid]) {
      groups[cid] = {
        candidate_id: cid,
        candidate_name: i.candidate_name || i.title || 'Unknown Candidate',
        interviews: [],
      }
      order.push(cid)
    }
    groups[cid].interviews.push(i)
  })

  return order.map((cid) => groups[cid])
}
