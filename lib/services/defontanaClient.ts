/**
 * Defontana API Client
 * Handles authentication and API calls to Defontana REST API
 * API Docs: https://replapi-doc.defontana.com/
 * Swagger: https://replapi.defontana.com/swagger/index.html
 */

const DEFONTANA_BASE_URL = 'https://replapi.defontana.com'

interface DefontanaConfig {
  email: string
  password: string
}

interface DefontanaAuthResponse {
  token: string
  expiration: string
}

interface DefontanaSale {
  folio: number
  fecha: string
  cliente: string
  productoId: string
  productoNombre: string
  cantidad: number
  precioUnitario: number
  total: number
  tipoDocumento: string
  canal?: string
}

/**
 * Get authentication token from Defontana API
 */
async function authenticate(config: DefontanaConfig): Promise<string> {
  const response = await fetch(`${DEFONTANA_BASE_URL}/api/Account/Login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: config.email,
      password: config.password,
    }),
  })

  if (!response.ok) {
    throw new Error(`Defontana auth failed: ${response.statusText}`)
  }

  const data: DefontanaAuthResponse = await response.json()
  return data.token
}

/**
 * Get sales data by date range
 * Endpoint: /api/Sale/GetSaleByDate
 */
export async function getSalesByDate(
  config: DefontanaConfig,
  startDate: string, // Format: YYYY-MM-DD
  endDate: string // Format: YYYY-MM-DD
): Promise<DefontanaSale[]> {
  const token = await authenticate(config)

  const response = await fetch(
    `${DEFONTANA_BASE_URL}/api/Sale/GetSaleByDate?startDate=${startDate}&endDate=${endDate}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Defontana API error: ${response.statusText}`)
  }

  const data = await response.json()
  return data
}

/**
 * Get inventory/stock data
 * Endpoint: /api/Inventory/GetInventory
 */
export async function getInventory(config: DefontanaConfig): Promise<any[]> {
  const token = await authenticate(config)

  const response = await fetch(`${DEFONTANA_BASE_URL}/api/Inventory/GetInventory`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Defontana API error: ${response.statusText}`)
  }

  const data = await response.json()
  return data
}

/**
 * Transform Defontana sales to our ventas_historicas format
 */
export function transformDefontanaSales(sales: DefontanaSale[]) {
  return sales.map(sale => ({
    empresa: 'Defontana', // Or extract from sale data if available
    canal: sale.canal || 'Defontana',
    fecha: sale.fecha.split('T')[0], // Convert to YYYY-MM-DD
    sku: sale.productoId,
    mlc: null, // Map if available
    descripcion: sale.productoNombre,
    unidades: sale.cantidad,
    precio: sale.precioUnitario,
  }))
}
