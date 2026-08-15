/**
 * The deterministic half of demonstration QA: `pbakaus/impeccable`'s own
 * anti-pattern detector, run against the demonstration HORUS has just built,
 * before any agent judgment and before DEC-004 gate one.
 *
 * Why this exists at all. `docs/DESIGN_REFERENCES.md` has listed impeccable
 * and `Leonxlnx/taste-skill` as "Adopted, DEC-114" since 2026-08-10, but what
 * DEC-114 actually did was hand-transcribe about eight token-level rules from
 * their READMEs into CSS constants. Neither repository was ever installed and
 * neither was ever run. Running the real detector against the real generator
 * output for the first time (2026-08-11) found six failures in the shipped
 * template — including two rules DEC-114 recorded as *adopted from*
 * impeccable that impeccable itself classifies as anti-patterns
 * (`cream-palette`, `hero-eyebrow-chip`). A transcribed rule is a claim; a
 * detector that runs is a check. This module is the check.
 *
 * Boundary. This is deterministic code, not an agent, and it decides nothing
 * consequential: it returns findings. Whether a lead advances, retries, or
 * stops is `run-lead.ts`'s call, and publication remains the operator's
 * (DEC-004, DEC-045). The detector never sees the network — `detectHtml` is
 * impeccable's static engine (htmlparser2 + css-tree + css-select), and the
 * browser engine that would launch Chromium is deliberately not declared in
 * `impeccable.d.ts` and not installed.
 *
 * Failure posture, per charter 9.6/10.4's "a sample proves presence, never
 * absence": if the detector cannot run, that is `unavailable` — never
 * `passed`. A QA step that silently reports success because its checker was
 * missing is the exact failure this project's evidence discipline exists to
 * prevent.
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export type ImpeccableSeverity = 'error' | 'warning' | 'advisory'

export interface ImpeccableFinding {
  /** Stable rule id from impeccable's registry, e.g. `hero-eyebrow-chip`. Safe to match on. */
  antipattern: string
  name: string
  description: string
  severity: ImpeccableSeverity
  category: string | null
  /** impeccable's own short description of the offending element, e.g. `11.84px body text`. */
  snippet: string
}

export type ImpeccableGateResult =
  /** No blocking findings. `advisory` may still be non-empty — advisories never block. */
  | { status: 'passed'; blocking: readonly []; advisory: readonly ImpeccableFinding[] }
  | { status: 'failed'; blocking: readonly ImpeccableFinding[]; advisory: readonly ImpeccableFinding[] }
  /** The detector itself could not run. NOT a pass — the caller must record it as unchecked. */
  | { status: 'unavailable'; reason: string; detail: string }

/**
 * impeccable's registry marks eleven rules `advisory` and describes them as
 * "opt-in noise rather than a failure" (its own words, on `em-dash-overuse`).
 * HORUS takes that at face value: `error` and `warning` block, `advisory` is
 * reported and does not. The set is impeccable's to define, not HORUS's —
 * there is deliberately no local override list here, because a local
 * exemption list is how DEC-114's transcription drifted from the source in
 * the first place.
 */
function isBlocking(severity: ImpeccableSeverity): boolean {
  return severity === 'error' || severity === 'warning'
}

function normalizeSeverity(raw: string): ImpeccableSeverity {
  return raw === 'error' || raw === 'advisory' ? raw : 'warning'
}

/**
 * `detectHtml` takes a path, not a string, so the page under test is written
 * to its own throwaway directory. That directory is created per call and
 * removed in a `finally`, so a detector crash cannot leave the built
 * demonstration sitting on disk — the artifact is agent-influenced content and
 * does not belong anywhere durable until the operator has approved it.
 *
 * `scratchRoot` should be under the application's own data directory, the same
 * convention `working-directory.ts` follows for agent runs, so QA artifacts are
 * found with the rest of HORUS's state rather than in the shared OS temp dir.
 */
export async function runImpeccableGate(input: {
  html: string
  scratchRoot: string
  /** Injectable for tests; defaults to the real detector. */
  detect?: (filePath: string) => Promise<Array<{ antipattern: string; name: string; description: string; severity: string; category: string | null; snippet: string }>>
}): Promise<ImpeccableGateResult> {
  const directory = path.join(input.scratchRoot, `qa-${crypto.randomUUID()}`)
  const filePath = path.join(directory, 'demonstration.html')

  try {
    fs.mkdirSync(directory, { recursive: true })
    fs.writeFileSync(filePath, input.html, 'utf8')

    const detect = input.detect ?? (async (target: string) => {
      // Imported lazily so that a broken or absent install degrades to
      // `unavailable` at QA time rather than taking down the whole Electron
      // main process at startup.
      const { detectHtml } = await import('impeccable')
      return detectHtml(target)
    })

    const raw = await detect(filePath)

    const findings: ImpeccableFinding[] = raw.map((item) => ({
      antipattern: item.antipattern,
      name: item.name,
      description: item.description,
      severity: normalizeSeverity(item.severity),
      category: item.category,
      snippet: item.snippet,
    }))

    const blocking = findings.filter((finding) => isBlocking(finding.severity))
    const advisory = findings.filter((finding) => !isBlocking(finding.severity))

    return blocking.length === 0
      ? { status: 'passed', blocking: [], advisory }
      : { status: 'failed', blocking, advisory }
  } catch (error) {
    return {
      status: 'unavailable',
      reason: 'detector_failed',
      detail: error instanceof Error ? error.message : String(error),
    }
  } finally {
    try {
      fs.rmSync(directory, { recursive: true, force: true })
    } catch {
      // A leftover scratch directory is not worth failing QA over, and
      // reporting `unavailable` here would misreport a completed check.
    }
  }
}

/**
 * The blocking findings, rendered as the instruction line a fix pass acts on.
 * Kept here rather than in the agent task so that the deterministic gate owns
 * the wording of its own findings — the agent is told what failed, never asked
 * to decide whether it failed.
 */
export function describeBlockingFindings(findings: readonly ImpeccableFinding[]): string {
  return findings
    .map((finding, index) => `${index + 1}. [${finding.antipattern}] ${finding.name} — ${finding.description} (found: ${finding.snippet})`)
    .join('\n')
}
