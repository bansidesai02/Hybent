import api from './axios'

export const linkedinApi = {
  /** Returns the LinkedIn OAuth URL to open in a popup */
  getAuthUrl: () =>
    api.get<{ auth_url: string }>('/v1/linkedin/auth'),

  /** Returns whether the current user has a connected LinkedIn account */
  getStatus: () =>
    api.get<{ connected: boolean }>('/v1/linkedin/status'),

  /** Removes the stored LinkedIn access token */
  disconnect: () =>
    api.post('/v1/linkedin/disconnect'),

  /** Creates a LinkedIn post with optional base64 image */
  post: (data: { post_text: string; image_base64?: string }) =>
    api.post<{ post_url: string; post_id: string }>('/v1/linkedin/post', data),
}
