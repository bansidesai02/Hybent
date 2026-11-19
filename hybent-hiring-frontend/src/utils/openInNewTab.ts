/**
 * Opens a sign-in page (Google, Microsoft…) in a new tab, keeping this tab
 * where it is. The tab is opened during the click itself, before the link is
 * fetched, so the browser doesn't block it as a pop-up; if it was blocked
 * anyway, this tab goes to the link instead.
 */
export async function openInNewTab(getUrl: () => Promise<string | undefined | null>): Promise<void> {
  const tab = window.open('', '_blank')
  try {
    const url = await getUrl()
    if (!url) throw new Error('No sign-in link')
    if (tab) {
      tab.opener = null
      tab.location.href = url
    } else {
      window.location.href = url
    }
  } catch (err) {
    tab?.close()
    throw err
  }
}
