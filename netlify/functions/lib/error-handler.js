/**
 * Manejo centralizado de errores para Netlify Functions
 */

class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, details);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404);
  }
}

class RateLimitError extends AppError {
  constructor(retryAfter = 60) {
    super('Rate limit exceeded', 429);
    this.retryAfter = retryAfter;
  }
}

function handleError(error, headers = {}) {
  // Log error para debugging (solo en desarrollo)
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error:', error);
  }

  // Si es un error operacional esperado
  if (error.isOperational) {
    const responseHeaders = { ...headers };
    
    if (error instanceof RateLimitError) {
      responseHeaders['Retry-After'] = String(error.retryAfter);
    }

    return {
      statusCode: error.statusCode,
      headers: responseHeaders,
      body: JSON.stringify({
        success: false,
        error: error.message,
        ...(error.details && { details: error.details })
      })
    };
  }

  // Error inesperado - no exponer detalles al cliente
  return {
    statusCode: 500,
    headers,
    body: JSON.stringify({
      success: false,
      error: 'Internal server error'
    })
  };
}

// Wrapper para ejecutar funciones con manejo de errores
function withErrorHandling(handler) {
  return async (event, context) => {
    try {
      return await handler(event, context);
    } catch (error) {
      return handleError(error);
    }
  };
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  handleError,
  withErrorHandling
};
