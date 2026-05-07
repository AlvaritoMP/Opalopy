// Edge Function para recibir webhooks de Tally y crear candidatos
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ATTACHMENTS_BUCKET = 'candidate-attachments'

serve(async (req) => {
  // Manejar CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Obtener el webhookId de la URL
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const webhookId = pathParts[pathParts.length - 1]

    console.log(`📥 Webhook recibido de Tally - ID: ${webhookId}`)
    console.log(`🔍 URL completa: ${req.url}`)
    console.log(`🔍 Headers recibidos:`, Object.fromEntries(req.headers.entries()))
    
    // Verificar si hay apikey en la URL (query parameter)
    const apikeyFromUrl = url.searchParams.get('apikey')
    if (apikeyFromUrl) {
      console.log('✅ Apikey encontrado en URL')
    }

    // Parsear el body
    const tallyData = await req.json()
    console.log('📋 Datos recibidos:', JSON.stringify(tallyData, null, 2))

    // Inicializar cliente de Supabase con service role key
    // Usamos service role key para evitar problemas de RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Construir variantes de URL. Supabase puede exponer req.url sin el prefijo /functions/v1,
    // mientras que la app guarda la URL pública completa que se copia en Tally.
    const webhookUrl = `https://${url.host}${url.pathname}`
    const publicWebhookUrl = url.pathname.startsWith('/functions/v1')
      ? webhookUrl
      : `https://${url.host}/functions/v1${url.pathname}`
    const attemptedWebhookUrls = Array.from(new Set([webhookUrl, publicWebhookUrl]))
    console.log(`🔍 Buscando integración con webhook_url: ${attemptedWebhookUrls.join(' o ')}`)

    // 1. Buscar la integración por webhook URL
    const { data: integration, error: integrationError } = await supabase
      .from('form_integrations')
      .select('*')
      .in('webhook_url', attemptedWebhookUrls)
      .maybeSingle()

    if (integrationError) {
      console.error('❌ Error buscando integración:', integrationError)
      return new Response(
        JSON.stringify({ error: 'Error buscando integración', details: integrationError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!integration) {
      console.error(`❌ Integración no encontrada para webhook: ${attemptedWebhookUrls.join(' o ')}`)
      return new Response(
        JSON.stringify({ error: 'Integration not found', attemptedWebhookUrls }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Integración encontrada: ${integration.form_name} (${integration.id})`)

    // 2. Obtener el proceso asociado
    const { data: process, error: processError } = await supabase
      .from('processes')
      .select('id')
      .eq('id', integration.process_id)
      .eq('app_name', integration.app_name)
      .maybeSingle()

    if (processError) {
      console.error('❌ Error buscando proceso:', processError)
      return new Response(
        JSON.stringify({ error: 'Error buscando proceso', details: processError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!process) {
      console.error(`❌ Proceso no encontrado: ${integration.process_id}`)
      return new Response(
        JSON.stringify({ error: 'Process not found', processId: integration.process_id }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Obtener las etapas del proceso desde la tabla stages
    const { data: stages, error: stagesError } = await supabase
      .from('stages')
      .select('id, name, order_index')
      .eq('process_id', integration.process_id)
      .eq('app_name', integration.app_name)
      .order('order_index', { ascending: true })

    if (stagesError) {
      console.error('❌ Error buscando etapas:', stagesError)
      return new Response(
        JSON.stringify({ error: 'Error buscando etapas', details: stagesError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!stages || stages.length === 0) {
      console.error(`❌ Proceso no tiene etapas: ${integration.process_id}`)
      return new Response(
        JSON.stringify({ error: 'Process has no stages', processId: integration.process_id }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Proceso encontrado con ${stages.length} etapas`)

    // 4. Mapear campos de Tally a candidato
    const candidateData = mapTallyToCandidate(tallyData, integration)
    candidateData.process_id = integration.process_id
    candidateData.stage_id = stages[0].id
    candidateData.app_name = integration.app_name

    console.log('👤 Datos del candidato mapeados:', JSON.stringify(candidateData, null, 2))

    // Validar que al menos tenga nombre o email
    if (!candidateData.name && !candidateData.email) {
      console.error('❌ Candidato sin nombre ni email')
      return new Response(
        JSON.stringify({ error: 'Candidate must have at least name or email', candidateData }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const attachments = extractTallyAttachments(tallyData)

    // 5. Crear el candidato en Supabase
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .insert({
        ...candidateData,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (candidateError) {
      console.error('❌ Error creando candidato:', candidateError)
      return new Response(
        JSON.stringify({ error: 'Failed to create candidate', details: candidateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Candidato creado: ${candidate.id} - ${candidate.name || candidate.email}`)

    if (attachments.length > 0) {
      const materializedAttachments = await materializeTallyAttachments(
        supabase,
        attachments,
        candidate.id,
        integration.app_name,
      )

      const attachmentsToInsert = materializedAttachments.map((attachment: any) => ({
        id: crypto.randomUUID(),
        candidate_id: candidate.id,
        name: attachment.name,
        url: attachment.publicUrl || attachment.url,
        type: attachment.mimeType || attachment.type || 'application/octet-stream',
        size: attachment.size || 0,
        category: 'CV',
        uploaded_at: new Date().toISOString(),
        comment_id: null,
        app_name: integration.app_name,
      }))

      const { error: attachmentsError } = await supabase
        .from('attachments')
        .insert(attachmentsToInsert)

      if (attachmentsError) {
        console.warn('⚠️ Error guardando adjuntos (no crítico):', attachmentsError)
      } else {
        console.log(`✅ ${attachmentsToInsert.length} adjunto(s) guardado(s) para candidato ${candidate.id}`)
      }
    }

    // 6. Crear entrada en historial
    const { error: historyError } = await supabase
      .from('candidate_history')
      .insert({
        candidate_id: candidate.id,
        stage_id: stages[0].id,
        moved_at: new Date().toISOString(),
        moved_by: null, // Integración automática
        app_name: integration.app_name,
      })

    if (historyError) {
      console.warn('⚠️ Error creando historial (no crítico):', historyError)
      // No fallar el webhook por esto
    } else {
      console.log(`✅ Historial creado para candidato ${candidate.id}`)
    }

    console.log(`🎉 Webhook procesado exitosamente - Candidato: ${candidate.id}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        candidateId: candidate.id,
        candidateName: candidate.name || candidate.email
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error procesando webhook:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Función helper para obtener nombres estándar de campos
function getStandardFieldNames(candidateFieldKey: string): string[] {
  const mappings: { [key: string]: string[] } = {
    name: ['name', 'nombre', 'nombre completo', 'nombre_completo', 'full_name', 'nombre_y_apellidos', 'question_8d2xpz'],
    email: ['email', 'correo', 'correo electronico', 'correo electrónico', 'e-mail', 'question_ylg9wd'],
    phone: ['phone', 'telefono', 'teléfono', 'mobile', 'celular', 'question_kzeyde'],
    phone2: ['phone2', 'telefono2', 'teléfono_secundario', 'secondary_phone'],
    description: ['description', 'descripcion', 'notas', 'comments'],
    source: ['source', 'fuente', 'origen', 'donde viste', 'dónde viste', 'question_k0567v'],
    salary_expectation: ['salaryexpectation', 'salary expectation', 'expectativa_salarial', 'expectativa salarial', 'salario_esperado', 'question_l07bap'],
    dni: ['dni', 'documento', 'identificacion', 'identificación', 'documento_identidad', 'id_number', 'question_bbdxok'],
    linkedin_url: ['linkedinurl', 'linkedin url', 'linkedin', 'perfil_linkedin', 'question_pvykjb'],
    address: ['address', 'direccion', 'dirección'],
    province: ['province', 'provincia'],
    district: ['district', 'distrito'],
    age: ['age', 'edad', 'question_v2ea7d'],
  }
  return mappings[candidateFieldKey] || [candidateFieldKey]
}

function normalizeFieldName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stringifyTallyValue(field: any): string {
  if (field.value === null || field.value === undefined) return ''

  if (Array.isArray(field.value)) {
    const optionTexts = field.value
      .map((selectedValue: any) => {
        const option = field.options?.find((item: any) => item.id === selectedValue)
        return option?.text || selectedValue?.text || selectedValue?.name || selectedValue
      })
      .filter(Boolean)

    return optionTexts.join(', ')
  }

  if (typeof field.value === 'object') {
    return field.value.text || field.value.name || field.value.url || JSON.stringify(field.value)
  }

  return String(field.value)
}

function getCandidateFieldMappingKeys(candidateFieldKey: string): string[] {
  const aliases: { [key: string]: string[] } = {
    salary_expectation: ['salary_expectation', 'salaryExpectation'],
    linkedin_url: ['linkedin_url', 'linkedinUrl'],
  }

  return aliases[candidateFieldKey] || [candidateFieldKey]
}

function getTallyFields(tallyData: any): any[] {
  if (tallyData.data?.fields && Array.isArray(tallyData.data.fields)) {
    return tallyData.data.fields
  }

  if (tallyData.fields && Array.isArray(tallyData.fields)) {
    return tallyData.fields
  }

  return []
}

function extractTallyAttachments(tallyData: any): any[] {
  const fields = getTallyFields(tallyData)
  return fields
    .filter((field: any) => field.type === 'FILE_UPLOAD' && Array.isArray(field.value))
    .flatMap((field: any) => field.value)
    .filter((file: any) => file?.url)
}

function sanitizeFileName(fileName: string): string {
  return (fileName || 'archivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function ensureAttachmentsBucket(supabase: any) {
  const bucketOptions = {
    public: true,
    fileSizeLimit: 20 * 1024 * 1024,
    allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
  }

  const { data: existingBucket, error: getBucketError } = await supabase.storage.getBucket(ATTACHMENTS_BUCKET)
  if (existingBucket && !getBucketError) {
    const { error: updateError } = await supabase.storage.updateBucket(ATTACHMENTS_BUCKET, bucketOptions)
    if (updateError) {
      console.warn('⚠️ No se pudo actualizar bucket de adjuntos:', updateError)
    }
    return
  }

  const { error } = await supabase.storage.createBucket(ATTACHMENTS_BUCKET, bucketOptions)

  if (error && !String(error.message || '').toLowerCase().includes('already exists')) {
    console.warn('⚠️ No se pudo crear/verificar bucket de adjuntos:', error)
  }
}

async function uploadTallyAttachmentToStorage(supabase: any, attachment: any, candidateId: string, appName: string) {
  await ensureAttachmentsBucket(supabase)

  const fileResponse = await fetch(attachment.url)
  if (!fileResponse.ok) {
    throw new Error(`No se pudo descargar archivo de Tally (${fileResponse.status})`)
  }

  const contentType = attachment.mimeType || fileResponse.headers.get('content-type') || 'application/octet-stream'
  const fileBody = await fileResponse.arrayBuffer()
  const safeName = sanitizeFileName(attachment.name || attachment.id || 'archivo')
  const storagePath = `tally/${appName}/${candidateId}/${crypto.randomUUID()}-${safeName}`

  let uploadResult = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(storagePath, fileBody, {
      contentType,
      upsert: false,
    })

  if (uploadResult.error && String(uploadResult.error.message || '').toLowerCase().includes('bucket')) {
    await ensureAttachmentsBucket(supabase)
    uploadResult = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(storagePath, fileBody, {
        contentType,
        upsert: false,
      })
  }

  if (uploadResult.error) {
    throw uploadResult.error
  }

  const { data } = supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .getPublicUrl(storagePath)

  return {
    ...attachment,
    url: data.publicUrl,
    publicUrl: data.publicUrl,
    mimeType: contentType,
    size: attachment.size || fileBody.byteLength,
  }
}

async function materializeTallyAttachments(supabase: any, attachments: any[], candidateId: string, appName: string): Promise<any[]> {
  const uploadedAttachments = []

  for (const attachment of attachments) {
    try {
      const uploadedAttachment = await uploadTallyAttachmentToStorage(supabase, attachment, candidateId, appName)
      uploadedAttachments.push(uploadedAttachment)
      console.log(`✅ Archivo de Tally copiado a Supabase Storage: ${attachment.name}`)
    } catch (error) {
      console.warn(`⚠️ No se pudo copiar archivo de Tally, se conservará URL original: ${attachment.name}`, error)
      uploadedAttachments.push(attachment)
    }
  }

  return uploadedAttachments
}

// Función para mapear datos de Tally a formato de candidato
function mapTallyToCandidate(tallyData: any, integration: any): any {
  const candidate: any = {
    process_id: '',
    stage_id: '',
    name: '',
    email: '',
    phone: '',
    phone2: '',
    description: '',
    source: integration.form_name || 'Tally',
    salary_expectation: '',
    dni: '',
    linkedin_url: '',
    address: '',
    province: '',
    district: '',
    age: null,
  }

  const fields = getTallyFields(tallyData)
  const fieldsMap: { rawName: string; normalizedName: string; value: string }[] = []

  fields.forEach((field: any) => {
    const value = stringifyTallyValue(field)
    const names = [field.key, field.label].filter(Boolean)

    names.forEach((name: string) => {
      fieldsMap.push({
        rawName: name,
        normalizedName: normalizeFieldName(name),
        value,
      })
    })
  })

  console.log('🔍 Campos recibidos:', fieldsMap.map(field => field.rawName).join(', '))

  // Obtener mapeo personalizado si existe
  let customMapping: { [key: string]: string } = {}
  if (integration.field_mapping) {
    try {
      if (typeof integration.field_mapping === 'string') {
        customMapping = JSON.parse(integration.field_mapping)
      } else if (typeof integration.field_mapping === 'object') {
        customMapping = integration.field_mapping
      }
    } catch (err) {
      console.warn('Error parseando field_mapping:', err)
    }
  }

  // Función helper para obtener valor de campo
  const getFieldValue = (candidateFieldKey: string): string => {
    // 1. Si hay mapeo personalizado, usarlo primero
    for (const mappingKey of getCandidateFieldMappingKeys(candidateFieldKey)) {
      if (customMapping[mappingKey]) {
        const mappedTallyField = normalizeFieldName(customMapping[mappingKey])
        const matchedField = fieldsMap.find(field =>
          field.normalizedName === mappedTallyField ||
          field.normalizedName.includes(mappedTallyField) ||
          mappedTallyField.includes(field.normalizedName)
        )

        if (matchedField?.value) {
          return matchedField.value
        }
      }
    }
    
    // 2. Intentar con nombres estándar
    const standardNames = getStandardFieldNames(candidateFieldKey).map(normalizeFieldName)
    for (const standardName of standardNames) {
      const matchedField = fieldsMap.find(field =>
        field.normalizedName === standardName ||
        field.normalizedName.includes(standardName) ||
        standardName.includes(field.normalizedName)
      )

      if (matchedField?.value) {
        return matchedField.value
      }
    }
    
    return ''
  }

  // Mapear campos
  candidate.name = getFieldValue('name') || ''
  candidate.email = getFieldValue('email') || ''
  candidate.phone = getFieldValue('phone') || ''
  candidate.phone2 = getFieldValue('phone2') || ''
  candidate.description = getFieldValue('description') || ''
  candidate.salary_expectation = getFieldValue('salary_expectation') || ''
  candidate.dni = getFieldValue('dni') || ''
  candidate.linkedin_url = getFieldValue('linkedin_url') || ''
  candidate.address = getFieldValue('address') || ''
  candidate.province = getFieldValue('province') || ''
  candidate.district = getFieldValue('district') || ''
  
  // Manejar age como número
  const ageValue = getFieldValue('age')
  if (ageValue) {
    const ageNum = parseInt(ageValue, 10)
    candidate.age = isNaN(ageNum) ? null : ageNum
  }

  return candidate
}
