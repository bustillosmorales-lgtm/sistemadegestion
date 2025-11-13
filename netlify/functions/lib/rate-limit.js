/**
 * Rate limiting simple basado en memoria
 * Límites: 100 requests por minuto por usuario
 */

// Almacenamiento en memoria (se reinicia con cada cold start de la función)
const requestCounts = new Map();

// Configuración
const RATE_LIMIT = 100; // requests permitidos
const WINDOW_MS = 60 * 1000; // 1 minuto en milisegundos

function rateLimit(userId) {
  const now = Date.now();
  const userKey = userId || 'anonymous';
  
  // Obtener o crear registro del usuario
  let userRecord = requestCounts.get(userKey);
  
  if (!userRecord) {
    userRecord = {
      count: 0,
      resetTime: now + WINDOW_MS
    };
    requestCounts.set(userKey, userRecord);
  }
  
  // Resetear si pasó la ventana de tiempo
  if (now >= userRecord.resetTime) {
    userRecord.count = 0;
    userRecord.resetTime = now + WINDOW_MS;
  }
  
  // Incrementar contador
  userRecord.count++;
  
  // Verificar límite
  const remaining = Math.max(0, RATE_LIMIT - userRecord.count);
  const resetIn = Math.ceil((userRecord.resetTime - now) / 1000); // segundos
  
  const allowed = userRecord.count <= RATE_LIMIT;
  
  return {
    allowed,
    remaining,
    resetIn,
    limit: RATE_LIMIT
  };
}

// Limpiar registros antiguos cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (now >= record.resetTime + WINDOW_MS) {
      requestCounts.delete(key);
    }
  }
}, 5 * 60 * 1000);

module.exports = { rateLimit };
