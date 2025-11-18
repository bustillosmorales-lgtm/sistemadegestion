/**
 * Application-wide constants
 * Centralizes magic strings and configuration values
 */

export const EXCEL_SHEET_NAMES = {
  PREDICCIONES: 'Predicciones',
  VENTAS: 'BD - Ventas',
  STOCK: 'BD - Stock',
  TRANSITO: 'BD - Tránsito',
  COMPRAS: 'BD - Compras',
  PACKS: 'BD - Packs',
  DESCONSIDERAR: 'BD - Desconsiderar',
} as const

export const API_ENDPOINTS = {
  PREDICCIONES: '/.netlify/functions/predicciones',
  COTIZACIONES: '/.netlify/functions/cotizaciones',
  CONTENEDORES: '/.netlify/functions/contenedores',
  DATOS_BD: '/.netlify/functions/datos-bd',
  ALERTAS: '/.netlify/functions/alertas',
  DEFONTANA: '/.netlify/functions/defontana',
} as const

export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'No autorizado. Por favor, inicia sesión nuevamente.',
  SESSION_EXPIRED: 'Sesión expirada. Por favor, inicia sesión nuevamente.',
  FETCH_ERROR: 'Error al cargar datos',
  UPDATE_ERROR: 'Error al actualizar',
  DELETE_ERROR: 'Error al eliminar',
  CREATE_ERROR: 'Error al crear',
  NETWORK_ERROR: 'Error de conexión. Verifica tu conexión a internet.',
  UNKNOWN_ERROR: 'Ocurrió un error inesperado',
} as const

export const SUCCESS_MESSAGES = {
  SAVED: '✅ Guardado correctamente',
  UPDATED: '✅ Actualizado correctamente',
  DELETED: '✅ Eliminado correctamente',
  CREATED: '✅ Creado correctamente',
  SKU_EXCLUDED: '⚠️ SKU excluido del análisis',
  SKU_REACTIVATED: '✅ SKU reactivado en el análisis',
} as const

export const ESTADOS_COTIZACION = {
  PENDIENTE: 'pendiente',
  RESPONDIDA: 'respondida',
  APROBADA: 'aprobada',
  RECHAZADA: 'rechazada',
} as const

export const ESTADOS_CONTENEDOR = {
  PLANIFICACION: 'planificacion',
  CONFIRMADO: 'confirmado',
  EN_TRANSITO: 'en_transito',
  RECIBIDO: 'recibido',
} as const

export const CLASIFICACIONES_ABC = ['A', 'B', 'C'] as const
export const CLASIFICACIONES_XYZ = ['X', 'Y', 'Z'] as const

export const TENDENCIAS = {
  CRECIENTE: 'creciente',
  DECRECIENTE: 'decreciente',
  ESTABLE: 'estable',
} as const

export const MODELOS_FORECASTING = {
  NAIVE: 'naive',
  PROMEDIO_MOVIL: 'promedio_movil',
  SUAVIZADO_EXPONENCIAL: 'suavizado_exponencial',
  HOLT: 'holt',
  HOLT_WINTERS: 'holt_winters',
} as const

export const COLUMNAS_EXCEL = {
  PREDICCIONES: [
    { wch: 15 }, // SKU
    { wch: 40 }, // Descripción
    { wch: 8 },  // Clase
    { wch: 12 }, // Venta Diaria
    { wch: 15 }, // Precio Unitario
    { wch: 12 }, // Stock Actual
    { wch: 12 }, // Stock Óptimo
    { wch: 12 }, // Días Stock
    { wch: 12 }, // Tránsito China
    { wch: 18 }, // Sugerencia Reposición
    { wch: 18 }, // Valor Total Sugerencia
    { wch: 12 }, // Coef. Variación
    { wch: 12 }, // Tendencia
    { wch: 12 }, // Modelo
    { wch: 30 }, // Alertas
    { wch: 10 }, // MAPE
  ],
  VENTAS: [
    { wch: 12 }, // Empresa
    { wch: 12 }, // Canal
    { wch: 12 }, // Fecha
    { wch: 15 }, // SKU
    { wch: 15 }, // MLC
    { wch: 40 }, // Descripción
    { wch: 10 }, // Unidades
    { wch: 12 }, // Precio
  ],
  STOCK: [
    { wch: 15 }, // SKU
    { wch: 40 }, // Descripción
    { wch: 10 }, // Bodega C
    { wch: 10 }, // Bodega D
    { wch: 10 }, // Bodega E
    { wch: 10 }, // Bodega F
    { wch: 10 }, // Bodega H
    { wch: 10 }, // Bodega J
  ],
  TRANSITO: [
    { wch: 15 }, // SKU
    { wch: 10 }, // Unidades
    { wch: 15 }, // Estado
  ],
  COMPRAS: [
    { wch: 15 }, // SKU
    { wch: 12 }, // Fecha Compra
  ],
  PACKS: [
    { wch: 15 }, // SKU Pack
    { wch: 15 }, // SKU Componente
    { wch: 10 }, // Cantidad
  ],
  DESCONSIDERAR: [
    { wch: 15 }, // SKU
  ],
} as const

export const WORKFLOW_STATUS = {
  QUEUED: 'queued',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export const POLL_INTERVALS = {
  WORKFLOW_STATUS: 3000, // 3 segundos
  DATA_REFRESH: 30000,   // 30 segundos
} as const

export const DEBOUNCE_DELAYS = {
  SEARCH: 300,    // 300ms para búsqueda
  INPUT: 500,     // 500ms para inputs generales
  RESIZE: 150,    // 150ms para resize
} as const

export const TABLE_CONFIG = {
  DEFAULT_PAGE_SIZE: 50,
  PAGE_SIZE_OPTIONS: [25, 50, 100, 200],
} as const
