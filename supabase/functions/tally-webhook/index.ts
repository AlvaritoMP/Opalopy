// Edge Function para recibir webhooks de Tally y crear candidatos
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { applyImportTextCaseToCandidate } from '../_shared/importTextCase.ts'
import { buildTallyCandidateFromSubmission } from '../_shared/tallyMapping.ts'
import { processTallyCandidateUpsert } from '../_shared/tallyCandidateUpsert.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Supabase pasa pathname interno (/tally-webhook/id); en BD guardamos la URL pública. */
function buildPublicWebhookUrl(req: Request): string {
  const url = new URL(req.url)
  let path = url.pathname
  if (!path.includes('/functions/v1/')) {
    path = `/functions/v1${path.startsWith('/') ? path : `/${path}`}`
  }
  return `https://${url.host}${path}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const tallyData = await req.json()
    console.log('📋 Webhook Tally recibido')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Variables de entorno Supabase faltantes')
      return json({ error: 'Server misconfigured' }, 500)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const webhookUrl = buildPublicWebhookUrl(req)
    console.log('🔍 Buscando integración:', webhookUrl)

    const { data: integration, error: integrationError } = await supabase
      .from('form_integrations')
      .select('*')
      .eq('webhook_url', webhookUrl)
      .maybeSingle()

    if (integrationError) {
      console.error('❌ Error consultando integración:', integrationError.message)
      return json(
        { error: 'Database query failed', details: integrationError.message, webhookUrl },
        503
      )
    }

    if (!integration) {
      console.error('❌ Integración no encontrada:', webhookUrl)
      return json({ error: 'Integration not found', webhookUrl }, 404)
    }

    const { data: process, error: processError } = await supabase
      .from('processes')
      .select('id, is_bulk_process, bulk_config')
      .eq('id', integration.process_id)
      .eq('app_name', integration.app_name)
      .maybeSingle()

    if (processError || !process) {
      return json({ error: 'Process not found' }, 404)
    }

    const { data: stages, error: stagesError } = await supabase
      .from('stages')
      .select('id')
      .eq('process_id', integration.process_id)
      .eq('app_name', integration.app_name)
      .order('order_index', { ascending: true })
      .limit(1)

    if (stagesError || !stages?.length) {
      return json({ error: 'Process has no stages' }, 400)
    }

    const candidateData = buildTallyCandidateFromSubmission(tallyData, integration, process)
    applyImportTextCaseToCandidate(candidateData)

    candidateData.process_id = integration.process_id
    candidateData.stage_id = stages[0].id
    candidateData.app_name = integration.app_name

    console.log('👤 Candidato mapeado:', JSON.stringify(candidateData))

    if (!candidateData.name && !candidateData.email) {
      return json({ error: 'Candidate must have at least name or email' }, 400)
    }

    const bulkConfig =
      typeof process.bulk_config === 'string'
        ? JSON.parse(process.bulk_config)
        : process.bulk_config
    const customColumns = bulkConfig?.customColumns || []

    const upsertResult = await processTallyCandidateUpsert(supabase, {
      processId: integration.process_id,
      appName: integration.app_name,
      stageId: stages[0].id,
      candidateData,
      customColumns,
    })

    console.log(
      upsertResult.isReapplication
        ? `✅ Re-postulación #${upsertResult.applicationCount}: ${upsertResult.candidateId}`
        : `✅ Candidato creado: ${upsertResult.candidateId}`
    )
    return json({
      success: true,
      candidateId: upsertResult.candidateId,
      isReapplication: upsertResult.isReapplication,
      applicationCount: upsertResult.applicationCount,
    })
  } catch (error) {
    console.error('❌ Error procesando webhook:', error)
    return json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : String(error) },
      500
    )
  }
})
