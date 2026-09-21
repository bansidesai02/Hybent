import axios from './axios'

/**
 * Unauthenticated endpoints reached from outside the app — the shareable
 * "apply to this job" link (e.g. attached to a LinkedIn post).
 */
export const publicApi = {
  getJob: (orgSlug: string, jobId: string) =>
    axios.get(`/api/public/jobs/${orgSlug}/${jobId}`),

  apply: (
    orgSlug: string,
    jobId: string,
    data: {
      full_name: string
      email: string
      phone?: string
      linkedin_url?: string
      resume: File
    }
  ) => {
    const form = new FormData()
    form.append('full_name', data.full_name)
    form.append('email', data.email)
    if (data.phone) form.append('phone', data.phone)
    if (data.linkedin_url) form.append('linkedin_url', data.linkedin_url)
    form.append('resume', data.resume)
    return axios.post(`/api/public/jobs/${orgSlug}/${jobId}/apply`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
