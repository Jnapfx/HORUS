export type ApprovedComposeInput = {
  approvalId: string
  to: string
  subject: string
  body: string
}

export function buildGmailComposeHandoff(input: ApprovedComposeInput) {
  if (!input.approvalId) throw new Error('Outreach approval is required before opening Gmail compose')
  if (!isEmailAddress(input.to)) throw new Error('A valid recipient email address is required before opening Gmail compose')

  const handoff = new URL('https://mail.google.com/mail/')
  handoff.searchParams.set('view', 'cm')
  handoff.searchParams.set('fs', '1')
  handoff.searchParams.set('to', input.to)
  handoff.searchParams.set('su', input.subject)
  handoff.searchParams.set('body', input.body)
  return handoff.toString()
}

function isEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
