export const tokenStorage = {
  getAccessToken: (): string | null => {
    return localStorage.getItem('hybent_hiring_access_token') || sessionStorage.getItem('hybent_hiring_access_token')
  },
  getRefreshToken: (): string | null => {
    return localStorage.getItem('hybent_hiring_refresh_token') || sessionStorage.getItem('hybent_hiring_refresh_token')
  },
  setTokens: (accessToken: string, refreshToken: string | undefined, rememberMe: boolean) => {
    if (rememberMe) {
      localStorage.setItem('hybent_hiring_access_token', accessToken)
      if (refreshToken) localStorage.setItem('hybent_hiring_refresh_token', refreshToken)
      sessionStorage.removeItem('hybent_hiring_access_token')
      sessionStorage.removeItem('hybent_hiring_refresh_token')
    } else {
      sessionStorage.setItem('hybent_hiring_access_token', accessToken)
      if (refreshToken) sessionStorage.setItem('hybent_hiring_refresh_token', refreshToken)
      localStorage.removeItem('hybent_hiring_access_token')
      localStorage.removeItem('hybent_hiring_refresh_token')
    }
  },
  clear: () => {
    localStorage.removeItem('hybent_hiring_access_token')
    localStorage.removeItem('hybent_hiring_refresh_token')
    sessionStorage.removeItem('hybent_hiring_access_token')
    sessionStorage.removeItem('hybent_hiring_refresh_token')
  }
}
