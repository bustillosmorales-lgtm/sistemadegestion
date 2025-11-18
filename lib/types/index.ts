/**
 * Shared type definitions for the entire application
 * Centralizes all interfaces to avoid duplication
 */

export interface Prediccion {
  id: number
  sku: string
  descripcion: string
  venta_diaria_p50: number
  stock_actual: number
  stock_optimo: number
  dias_stock_actual: number
  transito_china: number
  sugerencia_reposicion: number
  valor_total_sugerencia: number
  precio_unitario: number
  coeficiente_variacion: number
  clasificacion_abc: string
  clasificacion_xyz: string
  tendencia: string
  modelo_usado: string
  alertas: string[]
  mape_backtesting: number | null
}

export interface Cotizacion {
  id: string
  sku: string
  descripcion: string
  cantidad: number
  proveedor: string
  precio_unitario: number | null
  lead_time_dias: number | null
  observaciones: string | null
  estado: 'pendiente' | 'respondida' | 'aprobada' | 'rechazada'
  fecha_creacion: string
  fecha_respuesta: string | null
  respondida_por: string | null
  contenedor_id: string | null
}

export interface Contenedor {
  id: string
  nombre: string
  estado: 'planificacion' | 'confirmado' | 'en_transito' | 'recibido'
  fecha_estimada_arribo: string | null
  fecha_arribo_real: string | null
  capacidad_cbm: number
  cbm_utilizado: number
  notas: string | null
  creado_en: string
}

export interface SkuExcluido {
  id: number
  sku: string
  descripcion: string
  motivo: string
  excluido_por: string
  fecha_exclusion: string
}

export interface ConfiguracionSistema {
  id: number
  clave: string
  valor: string
  descripcion: string
  tipo: 'numero' | 'texto' | 'booleano'
}

export interface FilterState {
  abc: string
  busqueda: string
  soloAlertas: boolean
}

export interface CotizacionFilterState {
  estado: string
  proveedor: string
  busqueda: string
}

export interface VentaHistorica {
  empresa: string
  canal: string
  fecha: string
  sku: string
  mlc: string | null
  descripcion: string | null
  unidades: number
  precio: number
}

export interface Stock {
  sku: string
  descripcion: string | null
  bodega_c: number
  bodega_d: number
  bodega_e: number
  bodega_f: number
  bodega_h: number
  bodega_j: number
}

export interface Transito {
  sku: string
  unidades: number
  estado: string
}

export interface Compra {
  sku: string
  fecha_compra: string
}

export interface Pack {
  sku_pack: string
  sku_componente: string
  cantidad: number
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}
