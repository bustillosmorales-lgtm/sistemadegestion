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
 * Uses /api/Auth/EmailLogin endpoint with query parameters
 */
async function authenticate(config: DefontanaConfig): Promise<string> {
  const params = new URLSearchParams({
    email: config.email,
    password: config.password
  })

  const response = await fetch(`${DEFONTANA_BASE_URL}/api/Auth/EmailLogin?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Defontana auth failed: ${response.status} - ${errorText}`)
  }

  const data: DefontanaAuthResponse = await response.json()
  return data.token
}

interface DefontanaSaleResponse {
  success: boolean
  message?: string
  exceptionMessage?: string
  totalItems: number
  pageNumber: number
  itemsPerPage: number
  saleList: DefontanaSaleDocument[]
}

interface DefontanaSaleDocument {
  documentType: string
  firstFolio: number
  emissionDate: string
  clientFile: string
  details: DefontanaSaleDetail[]
  total: number
}

interface DefontanaSaleDetail {
  detailLine: number
  type: string
  code: string // SKU
  count: number // Cantidad
  price: number // Precio unitario
  total: number
  comment?: string
}

/**
 * Get sales data by date range
 * Endpoint: /api/Sale/GetSalebyDate (note: lowercase 'b')
 */
export async function getSalesByDate(
  config: DefontanaConfig,
  initialDate: string, // Format: YYYY-MM-DD or ISO 8601
  endingDate: string // Format: YYYY-MM-DD or ISO 8601
): Promise<DefontanaSaleResponse> {
  const token = await authenticate(config)

  const params = new URLSearchParams({
    initialDate: initialDate,
    endingDate: endingDate
  })

  const response = await fetch(
    `${DEFONTANA_BASE_URL}/api/Sale/GetSalebyDate?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Defontana API error: ${response.status} - ${errorText}`)
  }

  const data: DefontanaSaleResponse = await response.json()

  if (!data.success) {
    throw new Error(data.exceptionMessage || data.message || 'Error desconocido de Defontana')
  }

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
 * Each sale document can have multiple detail lines (products)
 */
export function transformDefontanaSales(salesResponse: DefontanaSaleResponse) {
  const transformedSales: any[] = []

  if (!salesResponse.saleList) {
    return transformedSales
  }

  for (const saleDoc of salesResponse.saleList) {
    // Each sale document has multiple detail lines (products)
    for (const detail of saleDoc.details || []) {
      // Skip non-product lines (could be services, comments, etc.)
      if (!detail.code || detail.count <= 0) {
        continue
      }

      transformedSales.push({
        empresa: 'Defontana',
        canal: 'Defontana',
        fecha: saleDoc.emissionDate ? saleDoc.emissionDate.split('T')[0] : null,
        sku: detail.code,
        mlc: null,
        descripcion: detail.comment || detail.code,
        unidades: detail.count,
        precio: detail.price,
        metadata: {
          documentType: saleDoc.documentType,
          folio: saleDoc.firstFolio,
          clientFile: saleDoc.clientFile,
          detailLine: detail.detailLine
        }
      })
    }
  }

  return transformedSales
}
