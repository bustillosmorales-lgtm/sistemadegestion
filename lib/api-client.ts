/**
 * Cliente de API con autenticación automática
 */

import { createClient } from './supabase-auth'

export async function apiCall(endpoint: string, options: RequestInit = {}) {
  const supabase = createClient()

  // Obtener el token de sesión actual
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('No authenticated')
  }

  // Agregar el token al header
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  })

  if (!response.ok) {
    if (response.status === 401) {
      // Token expirado, intentar refrescar
      const { data: { session: newSession }, error } = await supabase.auth.refreshSession()
      
      if (error || !newSession) {
        // Redirigir a login si falla el refresh
        window.location.href = '/login'
        throw new Error('Session expired')
      }

      // Reintentar con el nuevo token
      headers['Authorization'] = `Bearer ${newSession.access_token}`
      const retryResponse = await fetch(endpoint, {
        ...options,
        headers,
      })

      if (!retryResponse.ok) {
        throw new Error(`API call failed: ${retryResponse.statusText}`)
      }

      return retryResponse
    }

    throw new Error(`API call failed: ${response.statusText}`)
  }

  return response
}

// Helpers específicos
export async function fetchPredicciones(params?: Record<string, string>) {
  const queryString = params ? '?' + new URLSearchParams(params).toString() : ''
  const response = await apiCall(`/.netlify/functions/predicciones${queryString}`)
  return response.json()
}

export async function fetchAlertas(params?: Record<string, string>) {
  const queryString = params ? '?' + new URLSearchParams(params).toString() : ''
  const response = await apiCall(`/.netlify/functions/alertas${queryString}`)
  return response.json()
}

export async function procesarExcel(filePath: string) {
  const response = await apiCall('/.netlify/functions/procesar-excel', {
    method: 'POST',
    body: JSON.stringify({ filePath }),
  })
  return response.json()
}

export async function fetchDatosBD(tabla: 'ventas' | 'stock' | 'transito' | 'compras' | 'packs' | 'desconsiderar') {
  const response = await apiCall(`/.netlify/functions/datos-bd?tabla=${tabla}`)
  return response.json()
}

// Cotizaciones API
export async function fetchCotizaciones(params?: { estado?: string; sku?: string }) {
  const queryString = params ? '?' + new URLSearchParams(params as any).toString() : ''
  const response = await apiCall(`/.netlify/functions/cotizaciones${queryString}`)
  return response.json()
}

export async function createCotizacion(data: {
  sku: string
  descripcion?: string
  cantidad_cotizar: number
  precio_unitario?: number
  notas?: string
}) {
  const response = await apiCall('/.netlify/functions/cotizaciones', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return response.json()
}

export async function updateCotizacion(id: number, data: {
  cantidad_cotizar?: number
  precio_unitario?: number
  estado?: 'pendiente' | 'aprobada' | 'rechazada' | 'recibida'
  notas?: string
}) {
  const response = await apiCall(`/.netlify/functions/cotizaciones/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return response.json()
}

export async function deleteCotizacion(id: number) {
  const response = await apiCall(`/.netlify/functions/cotizaciones/${id}`, {
    method: 'DELETE',
  })
  return response.json()
}
