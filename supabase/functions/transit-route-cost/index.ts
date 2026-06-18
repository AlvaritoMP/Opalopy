import { calculateRouteCostFromSteps, buildTransportFaresMap, type DirectionsTransitStep } from '../_shared/limaTransportFares.ts'

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

interface DirectionsResponse {
  status: string
  error_message?: string
  routes?: {
    legs?: {
      steps?: DirectionsTransitStep[]
    }[]
  }[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const body = await req.json() as {
      origin?: string
      destination?: string
      originDistrict?: string
      transportFares?: { id: string; label?: string; fare?: number; formal?: boolean }[]
    }
    const origin = body.origin?.trim()
    const destination = body.destination?.trim()
    const originDistrict = body.originDistrict?.trim()
    const faresMap = buildTransportFaresMap(body.transportFares || [])

    if (!origin || !destination) {
      return json({ error: 'Se requieren origin y destination' }, 400)
    }

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
    if (!apiKey) {
      return json({
        error: 'Google Maps API no configurada',
        details: 'Configure el secreto GOOGLE_MAPS_API_KEY en Supabase Edge Functions.',
      }, 503)
    }

    const params = new URLSearchParams({
      origin,
      destination,
      mode: 'transit',
      language: 'es',
      region: 'pe',
      key: apiKey,
    })

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`
    )

    if (!response.ok) {
      return json({ error: 'Error al consultar Google Directions API', details: response.statusText }, 502)
    }

    const data = await response.json() as DirectionsResponse

    if (data.status !== 'OK') {
      const message = data.error_message || data.status
      return json({ error: 'No se pudo calcular la ruta', details: message }, 422)
    }

    const steps = data.routes?.[0]?.legs?.[0]?.steps ?? []
    if (steps.length === 0) {
      return json({ error: 'La ruta no tiene tramos disponibles' }, 422)
    }

    const result = calculateRouteCostFromSteps(steps, originDistrict, faresMap)
    return json({ success: true, ...result })
  } catch (err) {
    console.error('transit-route-cost error:', err)
    return json({ error: 'Error interno', details: String(err) }, 500)
  }
})
