// utils/dataDisplayUtils.js
// Utilidades para mostrar datos con mensajes descriptivos en lugar de fallbacks numéricos

/**
 * Determina si un valor está siendo calculado o es un fallback
 * @param {any} value - El valor a verificar
 * @param {object} product - El producto completo para contexto
 * @param {string} field - El campo específico que se está evaluando
 * @returns {object} { isCalculating: boolean, displayValue: string|number }
 */
export const getDisplayValue = (value, product = {}, field = '') => {
  // Si el valor existe y no es 0, mostrarlo normalmente
  if (value && value > 0) {
    return { isCalculating: false, displayValue: value };
  }

  // Si es explícitamente 0 y hay indicadores de que está calculado
  if (value === 0 && product.metadata_calculated_at) {
    return { isCalculating: false, displayValue: 0 };
  }

  // Casos específicos donde mostrar mensaje de análisis
  switch (field) {
    case 'venta_diaria':
    case 'ventaDiaria':
      return { isCalculating: true, displayValue: 'Analizando ventas...' };

    case 'impacto_economico':
    case 'valorTotal':
      return { isCalculating: true, displayValue: 'Calculando impacto...' };

    case 'precio_venta_sugerido':
      return { isCalculating: true, displayValue: 'Procesando precio...' };

    case 'margen':
      return { isCalculating: true, displayValue: 'Calculando margen...' };

    case 'gananciaNeta':
      return { isCalculating: true, displayValue: 'Analizando ganancia...' };

    case 'diasCobertura':
    case 'diasDeStock':
      return { isCalculating: true, displayValue: 'Calculando cobertura...' };

    default:
      return { isCalculating: true, displayValue: 'Analizando...' };
  }
};

/**
 * Formatea un valor monetario con mensaje descriptivo si está calculando
 * @param {number} value - Valor a formatear
 * @param {object} product - Producto para contexto
 * @param {string} field - Campo específico
 * @param {string} currency - Moneda (default: 'CLP')
 * @returns {string} Valor formateado o mensaje descriptivo
 */
export const formatCurrency = (value, product = {}, field = '', currency = 'CLP') => {
  const { isCalculating, displayValue } = getDisplayValue(value, product, field);

  if (isCalculating) {
    return displayValue;
  }

  if (currency === 'USD') {
    return `$${displayValue.toFixed(0).toLocaleString()}`;
  }

  return `$${displayValue.toLocaleString('es-CL')}`;
};

/**
 * Formatea un valor numérico con decimales o mensaje descriptivo
 * @param {number} value - Valor a formatear
 * @param {object} product - Producto para contexto
 * @param {string} field - Campo específico
 * @param {number} decimals - Número de decimales (default: 1)
 * @returns {string} Valor formateado o mensaje descriptivo
 */
export const formatNumber = (value, product = {}, field = '', decimals = 1) => {
  const { isCalculating, displayValue } = getDisplayValue(value, product, field);

  if (isCalculating) {
    return displayValue;
  }

  return displayValue.toFixed(decimals);
};

/**
 * Formatea días de stock con mensaje descriptivo
 * @param {number} diasDeStock - Días de stock calculados
 * @param {object} product - Producto para contexto
 * @returns {string} Días formateados o mensaje descriptivo
 */
export const formatDaysOfStock = (diasDeStock, product = {}) => {
  const ventaDiaria = product.venta_diaria || product.ventaDiaria || 0;
  const stockActual = product.stock_actual || product.stockActual || 0;

  // Si no hay venta diaria calculada, mostrar mensaje
  if (!ventaDiaria || ventaDiaria === 0) {
    return 'Analizando consumo...';
  }

  // Si el cálculo está en progreso
  if (diasDeStock === undefined || diasDeStock === null) {
    return 'Calculando cobertura...';
  }

  // Si es infinito
  if (diasDeStock === Infinity || diasDeStock > 9999) {
    return '∞';
  }

  return Math.round(diasDeStock).toString();
};

/**
 * Formatea porcentaje con mensaje descriptivo
 * @param {number} percentage - Porcentaje a formatear
 * @param {object} product - Producto para contexto
 * @param {string} field - Campo específico
 * @returns {string} Porcentaje formateado o mensaje descriptivo
 */
export const formatPercentage = (percentage, product = {}, field = '') => {
  const { isCalculating, displayValue } = getDisplayValue(percentage, product, field);

  if (isCalculating) {
    return displayValue;
  }

  return `${displayValue.toFixed(1)}%`;
};

/**
 * Determina si se debe mostrar un spinner de carga junto al texto
 * @param {any} value - Valor a verificar
 * @param {object} product - Producto para contexto
 * @param {string} field - Campo específico
 * @returns {boolean} Si debe mostrar spinner
 */
export const shouldShowSpinner = (value, product = {}, field = '') => {
  const { isCalculating } = getDisplayValue(value, product, field);
  return isCalculating;
};

/**
 * Componente de React para mostrar valor con spinner opcional
 * @param {object} props - { value, product, field, className, prefix, suffix }
 * @returns {JSX.Element} Elemento con valor y spinner opcional
 */
export const DisplayValueWithSpinner = ({
  value,
  product = {},
  field = '',
  className = '',
  prefix = '',
  suffix = '',
  formatter = null
}) => {
  const { isCalculating, displayValue } = getDisplayValue(value, product, field);

  const formattedValue = formatter ? formatter(displayValue, product, field) : displayValue;

  return (
    <span className={`${className} ${isCalculating ? 'text-blue-600' : ''}`}>
      {prefix}
      {isCalculating && (
        <span className="inline-block animate-spin mr-1">⏳</span>
      )}
      {formattedValue}
      {suffix}
    </span>
  );
};