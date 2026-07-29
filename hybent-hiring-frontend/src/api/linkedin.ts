import axios from './axios'

export const linkedinApi = {
  /** Check whether the current user has a stored LinkedIn token */
  status: () =>
    axios.get('/v1/linkedin/status'),

  /** Get the LinkedIn OAuth authorization URL (open in a popup) */
  connectUrl: () =>
    axios.get('/v1/linkedin/connect-url'),

  /**
   * Publish a post to LinkedIn.
   * @param text - Full post text including hashtags
   * @param image_base64 - Optional base64 data-URL of the banner image
   */
  post: (data: { text: string; image_base64?: string }) =>
    axios.post('/v1/linkedin/post', data),

  /** Remove the stored LinkedIn access token */
  disconnect: () =>
    axios.delete('/v1/linkedin/disconnect'),
}
