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
  validateInput
};
