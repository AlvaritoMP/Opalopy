// Edge Function para recibir webhooks de Tally y crear candidatos
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // Construir la URL del webhook (usar https siempre)
    const webhookUrl = `https://${url.host}${url.pathname}`
    console.log(`🔍 Buscando integración con webhook_url: ${webhookUrl}`)

    // 1. Buscar la integración por webhook URL
    const { data: integration, error: integrationError } = await supabase
      .from('form_integrations')
      .select('*')
      .eq('webhook_url', webhookUrl)
      .maybeSingle()

    if (integrationError) {
      console.error('❌ Error buscando integración:', integrationError)
      return new Response(
        JSON.stringify({ error: 'Error buscando integración', details: integrationError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!integration) {
      console.error(`❌ Integración no encontrada para webhook: ${webhookUrl}`)
      return new Response(
        JSON.stringify({ error: 'Integration not found', webhookUrl }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Integración encontrada: ${integration.form_name} (${integration.id})`)

    // 2. Obtener el proceso asociado
    const { data: process, error: processError } = await supabase
      .from('processes')
      .select('id, stages')
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

    if (!process.stages || process.stages.length === 0) {
      console.error(`❌ Proceso no tiene etapas: ${integration.process_id}`)
      return new Response(
        JSON.stringify({ error: 'Process has no stages', processId: integration.process_id }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Proceso encontrado con ${process.stages.length} etapas`)

    // 3. Mapear campos de Tally a candidato
    const candidateData = mapTallyToCandidate(tallyData, integration)
    candidateData.process_id = integration.process_id
    candidateData.stage_id = process.stages[0].id
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

    // 4. Crear el candidato en Supabase
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

    // 5. Crear entrada en historial
    const { error: historyError } = await supabase
      .from('candidate_history')
      .insert({
        candidate_id: candidate.id,
        stage_id: process.stages[0].id,
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
    name: ['name', 'nombre', 'nombre_completo', 'full_name', 'nombre_y_apellidos'],
    email: ['email', 'correo', 'e-mail'],
    phone: ['phone', 'telefono', 'teléfono', 'mobile', 'celular'],
    phone2: ['phone2', 'telefono2', 'teléfono_secundario', 'secondary_phone'],
    description: ['description', 'descripcion', 'notas', 'comments'],
    source: ['source', 'fuente', 'origen'],
    salary_expectation: ['salaryexpectation', 'expectativa_salarial', 'salario_esperado'],
    dni: ['dni', 'documento', 'documento_identidad', 'id_number'],
    linkedin_url: ['linkedinurl', 'linkedin', 'perfil_linkedin'],
    address: ['address', 'direccion', 'dirección'],
    province: ['province', 'provincia'],
    district: ['district', 'distrito'],
    age: ['age', 'edad'],
  }
  return mappings[candidateFieldKey] || [candidateFieldKey]
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

  // Obtener campos de Tally
  // Tally puede enviar los datos en diferentes formatos
  let fields: any[] = []
  
  if (tallyData.data && tallyData.data.fields) {
    fields = tallyData.data.fields
  } else if (tallyData.fields) {
    fields = tallyData.fields
  }

  // Convertir array de fields a objeto para búsqueda rápida
  const fieldsMap: { [key: string]: string } = {}
  fields.forEach((field: any) => {
    const key = field.key?.toLowerCase() || ''
    const label = field.label?.toLowerCase() || ''
    const value = field.value || ''
    
    if (key) fieldsMap[key] = value
    if (label) fieldsMap[label] = value
  })

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
    if (customMapping[candidateFieldKey]) {
      const mappedTallyField = customMapping[candidateFieldKey].toLowerCase()
      if (fieldsMap[mappedTallyField] !== undefined && fieldsMap[mappedTallyField] !== '') {
        return fieldsMap[mappedTallyField]
      }
    }
    
    // 2. Intentar con nombres estándar
    const standardNames = getStandardFieldNames(candidateFieldKey)
    for (const name of standardNames) {
      if (fieldsMap[name] !== undefined && fieldsMap[name] !== '') {
        return fieldsMap[name]
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
