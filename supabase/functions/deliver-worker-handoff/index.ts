// Edge Function: entrega un paquete local (BD ATS) al endpoint de ingesta de OpsFlow.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const APP_NAME = 'Opalopy'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface OpsflowIngestItem {
  sourceCandidateId: string
  sourceProcessId: string
  workerName: string
  workerSnapshot: Record<string, unknown>
}

interface OpsflowIngestPayload {
  sourcePackageId: string
  sourceApp: string
  payloadVersion: number
  sentAt: string
  workerCount: number
  senderNote?: string
  createdByName?: string
  items: OpsflowIngestItem[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const opsflowUrl = Deno.env.get('OPSFLOW_HANDOFF_INGEST_URL')
    const opsflowSecret = Deno.env.get('OPSFLOW_HANDOFF_INGEST_SECRET')

    if (!supabaseUrl || !supabaseServiceKey) {
      return json({ error: 'Server misconfigured: missing Supabase env' }, 500)
    }
    if (!opsflowUrl || !opsflowSecret) {
      return json({ error: 'Server misconfigured: missing OpsFlow ingest env' }, 500)
    }

    const body = await req.json().catch(() => ({}))
    const packageId = typeof body?.packageId === 'string' ? body.packageId.trim() : ''
    if (!packageId) {
      return json({ error: 'packageId is required' }, 400)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: pkg, error: pkgError } = await supabase
      .from('worker_handoff_packages')
      .select('*')
      .eq('id', packageId)
      .eq('source_app', APP_NAME)
      .maybeSingle()

    if (pkgError) {
      return json({ error: 'Failed to load package', details: pkgError.message }, 500)
    }
    if (!pkg) {
      return json({ error: 'Package not found' }, 404)
    }

    const { data: items, error: itemsError } = await supabase
      .from('worker_handoff_items')
      .select('*')
      .eq('package_id', packageId)
      .order('created_at', { ascending: true })

    if (itemsError) {
      return json({ error: 'Failed to load package items', details: itemsError.message }, 500)
    }
    if (!items || items.length === 0) {
      return json({ error: 'Package has no items' }, 400)
    }

    const payload: OpsflowIngestPayload = {
      sourcePackageId: pkg.id,
      sourceApp: APP_NAME,
      payloadVersion: pkg.payload_version ?? 1,
      sentAt: pkg.sent_at,
      workerCount: pkg.worker_count,
      senderNote: pkg.sender_note ?? undefined,
      createdByName: pkg.created_by_name ?? undefined,
      items: items.map((item) => ({
        sourceCandidateId: item.source_candidate_id,
        sourceProcessId: item.source_process_id,
        workerName: item.worker_name,
        workerSnapshot: item.worker_snapshot as Record<string, unknown>,
      })),
    }

    const opsflowResponse = await fetch(opsflowUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opsflowSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const responseText = await opsflowResponse.text()
    let responseBody: Record<string, unknown> = {}
    try {
      responseBody = responseText ? JSON.parse(responseText) : {}
    } catch {
      responseBody = { raw: responseText }
    }

    const now = new Date().toISOString()

    if (!opsflowResponse.ok) {
      const errorMessage =
        (typeof responseBody.error === 'string' && responseBody.error) ||
        (typeof responseBody.message === 'string' && responseBody.message) ||
        `OpsFlow respondió ${opsflowResponse.status}`

      await supabase
        .from('worker_handoff_packages')
        .update({
          delivery_status: 'failed',
          delivery_error: errorMessage.slice(0, 1000),
          updated_at: now,
        })
        .eq('id', packageId)

      return json(
        {
          error: 'OpsFlow delivery failed',
          details: errorMessage,
          status: opsflowResponse.status,
        },
        502
      )
    }

    const opsflowPackageId =
      typeof responseBody.id === 'string' ? responseBody.id : null

    await supabase
      .from('worker_handoff_packages')
      .update({
        delivery_status: 'delivered',
        opsflow_package_id: opsflowPackageId,
        delivery_error: null,
        delivered_at: now,
        updated_at: now,
      })
      .eq('id', packageId)

    return json({
      success: true,
      packageId,
      opsflowPackageId,
      duplicate: responseBody.duplicate === true,
      status: responseBody.status ?? 'received',
    })
  } catch (error) {
    console.error('deliver-worker-handoff error:', error)
    return json(
      {
        error: 'Internal error',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})
