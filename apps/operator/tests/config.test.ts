import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { OperatorConfigInvalid, OperatorConfigMissing, getHomeBaseCoordinates, loadOperatorConfig, requireSerpApiKey } from '../electron/config'

const temporaryDirectories: string[] = []

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true }))
})

function writeConfig(contents: unknown) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'horus-config-'))
  temporaryDirectories.push(dir)
  const file = path.join(dir, 'local.json')
  fs.writeFileSync(file, typeof contents === 'string' ? contents : JSON.stringify(contents))
  return file
}

const validConfig = {
  operator: { name: 'Javier Napoles', email: 'javier@example.com' },
  home_base: { address: '1 Test St', city: 'Stamford', state: 'CT', postal_code: '06901' },
  search_defaults: { target_qualified: 5, max_examined: 60 },
  credentials: { serpapi_key: 'sk-real-value', pagespeed_api_key: 'ps-real-value' },
  deployment: { pages_project: 'horus-demos', base_url: 'https://horus-demos.pages.dev' },
}

describe('loadOperatorConfig', () => {
  it('parses a well-formed config, converting snake_case fields to camelCase', () => {
    const config = loadOperatorConfig(writeConfig(validConfig))
    expect(config.credentials.serpapiKey).toBe('sk-real-value')
    expect(config.homeBase.city).toBe('Stamford')
    expect(config.searchDefaults.maxExamined).toBe(60)
  })

  it('throws OperatorConfigMissing when the file does not exist', () => {
    expect(() => loadOperatorConfig('/tmp/horus-config-does-not-exist/local.json')).toThrow(OperatorConfigMissing)
  })

  it('throws OperatorConfigInvalid for malformed JSON', () => {
    expect(() => loadOperatorConfig(writeConfig('{ not json'))).toThrow(OperatorConfigInvalid)
  })

  it('throws OperatorConfigInvalid when a required section is missing', () => {
    const { credentials: _omitted, ...withoutCredentials } = validConfig
    expect(() => loadOperatorConfig(writeConfig(withoutCredentials))).toThrow('credentials')
  })

  it('never throws for an empty (example-file-style) credential — that is requireSerpApiKey\'s job', () => {
    const exampleShaped = { ...validConfig, credentials: { serpapi_key: '', pagespeed_api_key: '' } }
    const config = loadOperatorConfig(writeConfig(exampleShaped))
    expect(config.credentials.serpapiKey).toBe('')
  })

  it('loads a config written before DEC-074 with no latitude/longitude fields at all, defaulting both to null', () => {
    const config = loadOperatorConfig(writeConfig(validConfig))
    expect(config.homeBase.latitude).toBeNull()
    expect(config.homeBase.longitude).toBeNull()
  })

  it('parses real latitude/longitude when present', () => {
    const withCoordinates = { ...validConfig, home_base: { ...validConfig.home_base, latitude: 41.0534, longitude: -73.5387 } }
    const config = loadOperatorConfig(writeConfig(withCoordinates))
    expect(config.homeBase.latitude).toBe(41.0534)
    expect(config.homeBase.longitude).toBe(-73.5387)
  })

  it('rejects a non-numeric latitude rather than silently ignoring it', () => {
    const bad = { ...validConfig, home_base: { ...validConfig.home_base, latitude: 'north-ish', longitude: -73.5387 } }
    expect(() => loadOperatorConfig(writeConfig(bad))).toThrow('latitude')
  })
})

describe('getHomeBaseCoordinates', () => {
  it('returns null when either coordinate is unset, never a guessed default', () => {
    const config = loadOperatorConfig(writeConfig(validConfig))
    expect(getHomeBaseCoordinates(config)).toBeNull()
  })

  it('returns the coordinate pair when both are set', () => {
    const withCoordinates = { ...validConfig, home_base: { ...validConfig.home_base, latitude: 41.0534, longitude: -73.5387 } }
    const config = loadOperatorConfig(writeConfig(withCoordinates))
    expect(getHomeBaseCoordinates(config)).toEqual({ latitude: 41.0534, longitude: -73.5387 })
  })
})

describe('requireSerpApiKey', () => {
  it('returns the key when present', () => {
    const config = loadOperatorConfig(writeConfig(validConfig))
    expect(requireSerpApiKey(config)).toBe('sk-real-value')
  })

  it('throws a clear, specific error when the key is blank, as config/local.json.example ships', () => {
    const exampleShaped = { ...validConfig, credentials: { serpapi_key: '', pagespeed_api_key: '' } }
    const config = loadOperatorConfig(writeConfig(exampleShaped))
    expect(() => requireSerpApiKey(config)).toThrow('no serpapi_key set')
  })
})
