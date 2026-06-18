/**
 * Upsert Tally → candidato (Deno Edge). Mantener alineado con lib/tallyCandidateUpsert.ts
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any

function normalizeDniKey(dni?: string): string {
  return (dni || '').replace(/\D/g, '')
}

function normalizePhoneKey(phone?: string): string {
  return (phone || '').replace(/\D/g, '')
}

function normalizePhoneKeyForMatch(phone?: string): string {
  const digits = normalizePhoneKey(phone)
  if (!digits) return ''
  return digits.length > 9 ? digits.slice(-9) : digits
}

function collectPhoneMatchKeys(...phones: (string | undefined)[]): string[] {
  const keys = new Set<string>()
  for (const phone of phones) {
    const key = normalizePhoneKeyForMatch(phone)
    if (key) keys.add(key)
  }
  return [...keys]
}

function normalizeEmailKey(email?: string): string {
  return (email || '').trim().toLowerCase()
}

function isPlaceholderImportEmail(email?: string): boolean {
  if (!email) return false
  return /@import\.opalo$/i.test(email) || /^sin-email\./i.test(email)
}

function hasBulkCellValue(val: unknown): boolean {
  if (val === null || val === undefined) return false
  if (typeof val === 'boolean') return true
  if (typeof val === 'number') return !Number.isNaN(val)
  if (typeof val === 'string') return val.trim() !== ''
  return true
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  return false
}

function pickMergedValue(existing: unknown, incoming: unknown): unknown {
  if (!isEmptyValue(existing)) return existing
  if (!isEmptyValue(incoming)) return incoming
  return existing
}

function isMissingColumnError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const msg = (error.message || '').toLowerCase()
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    msg.includes('schema cache') ||
    msg.includes('could not find') ||
    msg.includes('application_count') ||
    msg.includes('first_application_at') ||
    (msg.includes('column') && msg.includes('does not exist'))
  )
}

function buildPlaceholderEmail(candidate: Record<string, unknown>): string {
  const slug = String(candidate.dni || candidate.phone || candidate.name || 'candidato')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'candidato'
  return `sin-email.${slug}.fila0.tally@import.opalo`
}

function ensureTallyCandidateEmail(candidate: Record<string, unknown>): void {
  if (String(candidate.email || '').trim()) return
  candidate.email = buildPlaceholderEmail(candidate)
}

const STANDARD_MERGE_KEYS = [
  'name', 'email', 'phone', 'phone2', 'description', 'source',
  'salary_expectation', 'dni', 'linkedin_url', 'address', 'province', 'district', 'age',
]

const MATCH_SELECT_WITH_APPLICATION =
  'id, name, email, phone, phone2, description, source, salary_expectation, dni, linkedin_url, address, province, district, age, bulk_column_values, application_count, first_application_at, created_at, stage_id, application_started_date'

const MATCH_SELECT_BASE =
  'id, name, email, phone, phone2, description, source, salary_expectation, dni, linkedin_url, address, province, district, age, bulk_column_values, created_at, stage_id, application_started_date'

export interface TallyUpsertResult {
  candidateId: string
  isReapplication: boolean
  applicationCount: number
}

function findRowByPhoneMatch(rows: Record<string, unknown>[], incomingKeys: string[]) {
  if (!incomingKeys.length) return undefined
  return rows.find((row) => {
    const rowKeys = collectPhoneMatchKeys(row.phone as string, row.phone2 as string)
    return incomingKeys.some((key) => rowKeys.includes(key))
  })
}

function matchExisting(rows: Record<string, unknown>[], incoming: Record<string, unknown>) {
  const dniKey = normalizeDniKey(incoming.dni as string)
  const emailKey = normalizeEmailKey(incoming.email as string)
  const incomingPhoneKeys = collectPhoneMatchKeys(incoming.phone as string, incoming.phone2 as string)
  const hasRealEmail = emailKey && !isPlaceholderImportEmail(emailKey)

  if (dniKey) {
    const m = rows.find((r) => normalizeDniKey(r.dni as string) === dniKey)
    if (m) return m
  }
  if (hasRealEmail) {
    const m = rows.find(
      (r) => normalizeEmailKey(r.email as string) === emailKey && !isPlaceholderImportEmail(r.email as string)
    )
    if (m) return m
  }
  return findRowByPhoneMatch(rows, incomingPhoneKeys)
}

async function fetchExistingRows(
  supabase: Supa,
  processId: string,
  appName: string
): Promise<Record<string, unknown>[]> {
  let lastError: { message?: string; code?: string } | null = null
  for (const selectFields of [MATCH_SELECT_WITH_APPLICATION, MATCH_SELECT_BASE]) {
    const { data, error } = await supabase
      .from('candidates')
      .select(selectFields)
      .eq('process_id', processId)
      .eq('app_name', appName)
      .eq('archived', false)
    if (!error) return data || []
    lastError = error
    if (!isMissingColumnError(error)) throw error
  }
  if (lastError) throw lastError
  return []
}

export async function processTallyCandidateUpsert(
  supabase: Supa,
  params: {
    processId: string
    appName: string
    stageId: string
    candidateData: Record<string, unknown>
    customColumns?: unknown[]
  }
): Promise<TallyUpsertResult> {
  const { processId, appName, stageId, candidateData } = params
  const nowIso = new Date().toISOString()

  ensureTallyCandidateEmail(candidateData)

  const rows = await fetchExistingRows(supabase, processId, appName)
  const existing = rows.length ? matchExisting(rows, candidateData) : undefined

  if (existing?.id) {
    const update: Record<string, unknown> = {
      created_at: nowIso,
      application_count: Math.max(1, Number(existing.application_count) || 1) + 1,
    }
    if (!existing.first_application_at && existing.created_at) {
      update.first_application_at = existing.created_at
    }
    for (const key of STANDARD_MERGE_KEYS) {
      const merged = pickMergedValue(existing[key], candidateData[key])
      if (merged !== undefined && merged !== existing[key]) update[key] = merged
    }
    const base = { ...((existing.bulk_column_values as Record<string, unknown>) || {}) }
    const incomingBulk = candidateData.bulk_column_values as Record<string, unknown> | undefined
    if (incomingBulk) {
      for (const [k, v] of Object.entries(incomingBulk)) {
        if (!hasBulkCellValue(base[k]) && hasBulkCellValue(v)) base[k] = v
      }
      update.bulk_column_values = base
    }
    if (isEmptyValue(existing.application_started_date)) {
      update.application_started_date = nowIso
    }
    update.application_completed_date = nowIso

    let updated: { id: string; application_count?: number } | null = null
    let updateError: { message?: string; code?: string } | null = null

    ;({ data: updated, error: updateError } = await supabase
      .from('candidates')
      .update(update)
      .eq('id', existing.id)
      .eq('app_name', appName)
      .select('id, application_count')
      .single())

    if (updateError && isMissingColumnError(updateError)) {
      const fallback = { ...update }
      delete fallback.application_count
      delete fallback.first_application_at
      ;({ data: updated, error: updateError } = await supabase
        .from('candidates')
        .update(fallback)
        .eq('id', existing.id)
        .eq('app_name', appName)
        .select('id')
        .single())
    }

    if (updateError) throw updateError

    const computedCount =
      updated?.application_count != null
        ? Number(updated.application_count)
        : Math.max(1, Number(existing.application_count) || 1) + 1

    await supabase.from('candidate_history').insert({
      candidate_id: existing.id,
      stage_id: existing.stage_id || stageId,
      moved_at: nowIso,
      moved_by: null,
      app_name: appName,
    })

    return {
      candidateId: updated!.id as string,
      isReapplication: true,
      applicationCount: computedCount,
    }
  }

  const bulkValues = candidateData.bulk_column_values
  const insertPayload = { ...candidateData }
  delete insertPayload.bulk_column_values

  const baseInsert = {
    ...insertPayload,
    created_at: nowIso,
    application_started_date: nowIso,
    application_completed_date: nowIso,
  }

  let created: { id: string; application_count?: number } | null = null
  let insertError: { message?: string; code?: string } | null = null

  ;({ data: created, error: insertError } = await supabase
    .from('candidates')
    .insert({
      ...baseInsert,
      first_application_at: nowIso,
      application_count: 1,
      registration_origin: 'formulario',
    })
    .select('id, application_count')
    .single())

  if (insertError && isMissingColumnError(insertError)) {
    ;({ data: created, error: insertError } = await supabase
      .from('candidates')
      .insert({
        ...baseInsert,
        registration_origin: 'formulario',
      })
      .select('id')
      .single())
  }

  if (insertError && isMissingColumnError(insertError)) {
    ;({ data: created, error: insertError } = await supabase
      .from('candidates')
      .insert(baseInsert)
      .select('id')
      .single())
  }

  if (insertError) throw insertError

  if (bulkValues && typeof bulkValues === 'object' && Object.keys(bulkValues).length > 0) {
    const { error: bulkError } = await supabase
      .from('candidates')
      .update({ bulk_column_values: bulkValues })
      .eq('id', created!.id)
    if (bulkError) console.warn('bulk_column_values:', bulkError.message)
  }

  await supabase.from('candidate_history').insert({
    candidate_id: created!.id,
    stage_id: stageId,
    moved_at: nowIso,
    moved_by: null,
    app_name: appName,
  })

  return {
    candidateId: created!.id as string,
    isReapplication: false,
    applicationCount: created?.application_count != null ? Number(created.application_count) : 1,
  }
}
