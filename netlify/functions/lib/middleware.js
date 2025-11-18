/**
 * Netlify Functions Middleware
 * Provides reusable middleware for auth, CORS, and error handling
 */

const { verifyAuth, getCorsHeaders } = require('./auth')
const { handleError } = require('./error-handler')

/**
 * Wraps a handler with authentication and CORS middleware
 *
 * @param {Function} handler - The main handler function (event, context, auth) => Promise<response>
 * @param {Object} options - Middleware options
 * @param {boolean} options.requireAuth - Whether to require authentication (default: true)
 * @returns {Function} Wrapped handler function
 *
 * @example
 * exports.handler = withAuth(async (event, context, auth) => {
 *   // Your handler logic here
 *   // auth object is already verified
 *   return {
 *     statusCode: 200,
 *     body: JSON.stringify({ success: true })
 *   }
 * })
 */
function withAuth(handler, options = {}) {
  const { requireAuth = true } = options

  return async (event, context) => {
    const origin = event.headers.origin || ''
    const headers = getCorsHeaders(origin)

    // Handle OPTIONS requests for CORS
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers, body: '' }
    }

    // Verify authentication if required
    let auth = null
    let rateLimitHeaders = {}

    if (requireAuth) {
      auth = await verifyAuth(event)

      if (!auth.authenticated) {
        const statusCode = auth.rateLimitExceeded ? 429 : 401

        return {
          statusCode,
          headers: {
            ...headers,
            ...(auth.rateLimit
              ? {
                  'X-RateLimit-Limit': String(auth.rateLimit.limit),
                  'X-RateLimit-Remaining': '0',
                  'X-RateLimit-Reset': String(auth.rateLimit.resetIn),
                  'Retry-After': String(auth.retryAfter || 60),
                }
              : {}),
          },
          body: JSON.stringify({
            success: false,
            error: auth.error,
          }),
        }
      }

      // Prepare rate limit headers
      rateLimitHeaders = auth.rateLimit
        ? {
            'X-RateLimit-Limit': String(auth.rateLimit.limit),
            'X-RateLimit-Remaining': String(auth.rateLimit.remaining),
            'X-RateLimit-Reset': String(auth.rateLimit.resetIn),
          }
        : {}
    }

    try {
      // Call the main handler with auth context
      const result = await handler(event, context, auth)

      // Add CORS and rate limit headers to response
      return {
        ...result,
        headers: {
          ...headers,
          ...rateLimitHeaders,
          ...(result.headers || {}),
        },
      }
    } catch (error) {
      // Handle errors consistently
      const errorResponse = handleError(error)

      return {
        ...errorResponse,
        headers: {
          ...headers,
          ...rateLimitHeaders,
          ...(errorResponse.headers || {}),
        },
      }
    }
  }
}

/**
 * Wraps a handler with just CORS (no auth required)
 *
 * @param {Function} handler - The main handler function
 * @returns {Function} Wrapped handler function
 *
 * @example
 * exports.handler = withCors(async (event, context) => {
 *   // Public endpoint logic
 *   return {
 *     statusCode: 200,
 *     body: JSON.stringify({ message: 'Public data' })
 *   }
 * })
 */
function withCors(handler) {
  return withAuth(handler, { requireAuth: false })
}

/**
 * Wraps a handler with validation middleware
 * Validates request body/query against a schema
 *
 * @param {Function} handler - The main handler function
 * @param {Object} schemas - Validation schemas for different methods
 * @param {Object} schemas.GET - Zod schema for GET requests
 * @param {Object} schemas.POST - Zod schema for POST requests
 * @param {Object} schemas.PUT - Zod schema for PUT requests
 * @returns {Function} Wrapped handler function
 *
 * @example
 * const { z } = require('zod')
 *
 * exports.handler = withValidation(
 *   async (event, context, auth, validatedData) => {
 *     // validatedData is already validated
 *     return { statusCode: 200, body: JSON.stringify(validatedData) }
 *   },
 *   {
 *     POST: z.object({
 *       sku: z.string(),
 *       cantidad: z.number()
 *     })
 *   }
 * )
 */
function withValidation(handler, schemas) {
  return withAuth(async (event, context, auth) => {
    const method = event.httpMethod
    const schema = schemas[method]

    if (!schema) {
      // No validation schema for this method, proceed without validation
      return handler(event, context, auth, null)
    }

    let dataToValidate = {}

    if (method === 'GET') {
      dataToValidate = event.queryStringParameters || {}
    } else {
      try {
        dataToValidate = JSON.parse(event.body || '{}')
      } catch (error) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: 'Invalid JSON in request body',
          }),
        }
      }
    }

    // Validate data
    const validation = schema.safeParse(dataToValidate)

    if (!validation.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Validation error',
          details: validation.error.errors,
        }),
      }
    }

    // Call handler with validated data
    return handler(event, context, auth, validation.data)
  })
}

/**
 * Compose multiple middleware functions
 *
 * @param {...Function} middlewares - Middleware functions to compose
 * @returns {Function} Composed middleware function
 *
 * @example
 * exports.handler = compose(
 *   withAuth,
 *   withLogging,
 *   withCache
 * )(async (event, context, auth) => {
 *   // Handler logic
 * })
 */
function compose(...middlewares) {
  return (handler) => {
    return middlewares.reduceRight((wrapped, middleware) => {
      return middleware(wrapped)
    }, handler)
  }
}

module.exports = {
  withAuth,
  withCors,
  withValidation,
  compose,
}
