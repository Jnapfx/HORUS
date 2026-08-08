import fs from 'node:fs'

/**
 * Reads `config/local.json` (DEC-035). Never committed, never logged, never
 * written into documentation. This module only reads it from disk on demand —
 * it does not cache or export the parsed credential anywhere the renderer
 * could reach it; only main-process code that calls `loadOperatorConfig`
 * ever sees the returned object.
 */
export type OperatorConfig = {
  operator: { name: string; email: string }
  homeBase: { address: string; city: string; state: string; postalCode: string; latitude: number | null; longitude: number | null }
  searchDefaults: { targetQualified: number; maxExamined: number }
  credentials: { serpapiKey: string; pagespeedApiKey: string }
  deployment: { pagesProject: string; baseUrl: string }
}

export class OperatorConfigMissing extends Error {}
export class OperatorConfigInvalid extends Error {}

function requireField(record: Record<string, unknown>, field: string, context: string): unknown {
  if (!(field in record)) throw new OperatorConfigInvalid(`Operator configuration is missing "${field}" under ${context}.`)
  return record[field]
}

function requireString(record: Record<string, unknown>, field: string, context: string): string {
  const value = requireField(record, field, context)
  if (typeof value !== 'string') throw new OperatorConfigInvalid(`Operator configuration field "${context}.${field}" must be a string.`)
  return value
}

function requireNumber(record: Record<string, unknown>, field: string, context: string): number {
  const value = requireField(record, field, context)
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new OperatorConfigInvalid(`Operator configuration field "${context}.${field}" must be a number.`)
  return value
}

/**
 * DEC-074. `latitude`/`longitude` are new, optional fields on `home_base` —
 * absent from every `config/local.json` written before this decision, and
 * from `config/local.json.example`. Treated as optional (not required) so an
 * existing operator config keeps loading unchanged; proximity is simply
 * unavailable until the operator adds them once, the same one-time-manual
 * pattern DEC-016 already established for the rest of `home_base`.
 */
function optionalNumber(record: Record<string, unknown>, field: string, context: string): number | null {
  if (!(field in record) || record[field] === null || record[field] === undefined || record[field] === '') return null
  const value = record[field]
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new OperatorConfigInvalid(`Operator configuration field "${context}.${field}", if present, must be a number.`)
  return value
}

export function loadOperatorConfig(configPath: string): OperatorConfig {
  if (!fs.existsSync(configPath)) {
    throw new OperatorConfigMissing(
      `No operator configuration at ${configPath}. Copy config/local.json.example to config/local.json and fill in real values (DEC-035) before running a real search.`,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  } catch (error) {
    throw new OperatorConfigInvalid(`Operator configuration at ${configPath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (typeof parsed !== 'object' || parsed === null) throw new OperatorConfigInvalid('Operator configuration must be a JSON object.')
  const root = parsed as Record<string, unknown>

  const operator = requireField(root, 'operator', 'root') as Record<string, unknown>
  const homeBase = requireField(root, 'home_base', 'root') as Record<string, unknown>
  const searchDefaults = requireField(root, 'search_defaults', 'root') as Record<string, unknown>
  const credentials = requireField(root, 'credentials', 'root') as Record<string, unknown>
  const deployment = requireField(root, 'deployment', 'root') as Record<string, unknown>

  return {
    operator: { name: requireString(operator, 'name', 'operator'), email: requireString(operator, 'email', 'operator') },
    homeBase: {
      address: requireString(homeBase, 'address', 'home_base'),
      city: requireString(homeBase, 'city', 'home_base'),
      state: requireString(homeBase, 'state', 'home_base'),
      postalCode: requireString(homeBase, 'postal_code', 'home_base'),
      latitude: optionalNumber(homeBase, 'latitude', 'home_base'),
      longitude: optionalNumber(homeBase, 'longitude', 'home_base'),
    },
    searchDefaults: {
      targetQualified: requireNumber(searchDefaults, 'target_qualified', 'search_defaults'),
      maxExamined: requireNumber(searchDefaults, 'max_examined', 'search_defaults'),
    },
    credentials: {
      serpapiKey: requireString(credentials, 'serpapi_key', 'credentials'),
      pagespeedApiKey: requireString(credentials, 'pagespeed_api_key', 'credentials'),
    },
    deployment: {
      pagesProject: requireString(deployment, 'pages_project', 'deployment'),
      baseUrl: requireString(deployment, 'base_url', 'deployment'),
    },
  }
}

/**
 * A configuration file can exist and be well-formed while its credential
 * fields are still the empty strings `config/local.json.example` ships with.
 * Called only at the point a real request is about to be made, so the error
 * names exactly what is missing rather than failing the whole app at startup.
 */
export function requireSerpApiKey(config: OperatorConfig): string {
  if (!config.credentials.serpapiKey.trim()) {
    throw new OperatorConfigInvalid('config/local.json has no serpapi_key set. A real search cannot run without one.')
  }
  return config.credentials.serpapiKey
}

export function requirePageSpeedApiKey(config: OperatorConfig): string {
  if (!config.credentials.pagespeedApiKey.trim()) {
    throw new OperatorConfigInvalid('config/local.json has no pagespeed_api_key set. A real performance measurement cannot run without one.')
  }
  return config.credentials.pagespeedApiKey
}

/** DEC-074. Returns `null` rather than throwing — an unconfigured home base coordinate is a normal, expected state (proximity is simply unavailable), not a configuration error. */
export function getHomeBaseCoordinates(config: OperatorConfig): { latitude: number; longitude: number } | null {
  if (config.homeBase.latitude === null || config.homeBase.longitude === null) return null
  return { latitude: config.homeBase.latitude, longitude: config.homeBase.longitude }
}
