import axios from './axios'

export const linkedinApi = {
  /** Check whether the current user has a stored LinkedIn token */
  status: () =>
    axios.get('/v1/linkedin/status'),

  /** Get the LinkedIn OAuth authorization URL (open in a popup) */
  connectUrl: () =>
    axios.get('/v1/linkedin/connect-url'),

  /** Remove the stored LinkedIn access token */
  disconnect: () =>
    axios.delete('/v1/linkedin/disconnect'),
}
