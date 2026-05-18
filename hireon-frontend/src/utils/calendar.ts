export interface CalendarEventData {
  title: string
  scheduled_at: string
  duration_minutes: number
  meeting_link?: string | null
  notes?: string | null
  candidate_name?: string | null
}

export function getCalendarUrls(interview: CalendarEventData) {
  const title = interview.title || 'Interview'
  const startTime = new Date(interview.scheduled_at)
  const duration = interview.duration_minutes || 60
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000)

  const candidateDesc = interview.candidate_name ? `Candidate: ${interview.candidate_name}\n` : ''
  const meetDesc = interview.meeting_link ? `Meeting Link: ${interview.meeting_link}\n` : ''
  const notesDesc = interview.notes ? `Notes: ${interview.notes}\n` : ''
  const description = `${candidateDesc}${meetDesc}${notesDesc}Scheduled via Hireon AI`

  const location = interview.meeting_link || 'Virtual (Video Call)'

  const format = (d: Date) => {
    return d.toISOString().replace(/-|:|\.\d\d\d/g, '')
  }
  const startStr = format(startTime)
  const endStr = format(endTime)

  // Google Calendar URL
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startStr}/${endStr}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}`

  // Outlook URL
  const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodeURIComponent(title)}&startdt=${startTime.toISOString()}&enddt=${endTime.toISOString()}&body=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}`

  // ICS File URL (Data URI)
  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hireon AI//Calendar Integration//EN',
    'BEGIN:VEVENT',
    `SUMMARY:${title}`,
    `DTSTART:${startStr}`,
    `DTEND:${endStr}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ]
  const ics = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsLines.join('\n'))}`

  return { google, outlook, ics }
}
