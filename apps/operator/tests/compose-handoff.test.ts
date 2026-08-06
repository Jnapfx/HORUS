import { describe, expect, it } from 'vitest'
import { buildGmailComposeHandoff } from '../electron/compose-handoff'

describe('credential-free Gmail compose handoff', () => {
  it('requires an approval event and only produces a Gmail compose URL', () => {
    const url = new URL(buildGmailComposeHandoff({
      approvalId: 'approval_1',
      to: 'horus-test@example.invalid',
      subject: 'HORUS test',
      body: 'This is a local test only.',
    }))

    expect(url.origin).toBe('https://mail.google.com')
    expect(url.searchParams.get('view')).toBe('cm')
    expect(url.searchParams.get('to')).toBe('horus-test@example.invalid')
    expect(url.searchParams.get('body')).toBe('This is a local test only.')
  })

  it('refuses a handoff without explicit approval', () => {
    expect(() => buildGmailComposeHandoff({ approvalId: '', to: 'horus-test@example.invalid', subject: 'Test', body: 'Test' }))
      .toThrow('Outreach approval is required')
  })

  it('refuses a recipient that Gmail cannot recognize as an email address', () => {
    expect(() => buildGmailComposeHandoff({ approvalId: 'approval_1', to: 'example.invalid', subject: 'Test', body: 'Test' }))
      .toThrow('A valid recipient email address is required')
  })
})
