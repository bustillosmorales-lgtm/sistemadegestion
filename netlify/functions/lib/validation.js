/**
 * Esquemas de validación con Zod para las APIs
 */

const { z } = require('zod');

// Esquema para query params de predicciones
const prediccionesQuerySchema = z.object({
  sku: z.string().optional(),
  clasificacion_abc: z.enum(['A', 'B', 'C']).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).optional(),
}).strict();

// Esquema para query params de alertas
const alertasQuerySchema = z.object({
  tipo_alerta: z.string().optional(),
  severidad: z.enum(['critica', 'alta', 'media', 'baja']).optional(),
  estado: z.enum(['activa', 'resuelta', 'ignorada']).optional(),
}).strict();

// Esquema para body de procesar-excel
const procesarExcelBodySchema = z.object({
  filePath: z.string().min(1, 'filePath es requerido')
    .regex(/^uploads\/.*\.(xlsx|xls)$/i, 'El archivo debe ser un Excel válido'),
}).strict();

// Esquema para query params de cotizaciones
const cotizacionesQuerySchema = z.object({
  estado: z.enum(['pendiente', 'aprobada', 'rechazada', 'recibida']).optional(),
  sku: z.string().optional(),
}).strict();

// Esquema para POST cotizaciones
const cotizacionPostSchema = z.object({
  sku: z.string().min(1, 'SKU es requerido'),
  descripcion: z.string().optional(),
  cantidad_cotizar: z.number().int().positive('Cantidad debe ser mayor a 0'),
  precio_unitario: z.number().nonnegative('Precio debe ser mayor o igual a 0').optional().default(0),
  notas: z.string().optional(),
}).strict();

// Esquema para PUT cotizaciones (todos los campos opcionales excepto al menos uno requerido)
const cotizacionPutSchema = z.object({
  cantidad_cotizar: z.number().int().positive('Cantidad debe ser mayor a 0').optional(),
  precio_unitario: z.number().nonnegative('Precio debe ser mayor o igual a 0').optional(),
  estado: z.enum(['pendiente', 'aprobada', 'rechazada', 'recibida']).optional(),
  notas: z.string().optional(),
}).strict().refine(
  data => Object.keys(data).length > 0,
  { message: 'Al menos un campo debe ser actualizado' }
);

// Helper para validar y retornar errores formateados
function validateInput(schema, data) {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return {
        success: false,
        errors
      };
    }
    return {
      success: false,
      errors: [{ field: 'unknown', message: 'Validation error' }]
    };
  }
}

module.exports = {
  prediccionesQuerySchema,
  alertasQuerySchema,
  procesarExcelBodySchema,
  cotizacionesQuerySchema,
  cotizacionPostSchema,
  cotizacionPutSchema,
  validateInput
};
