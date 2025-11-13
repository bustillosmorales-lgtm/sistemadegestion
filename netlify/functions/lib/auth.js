/**
 * Helper de autenticación para Netlify Functions
 * Verifica el JWT de Supabase en las requests
 */

const { createClient } = require('@supabase/supabase-js');
const { rateLimit } = require('./rate-limit');

// Helper para verificar autenticación
async function verifyAuth(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authenticated: false,
      error: 'No authorization token provided'
    };
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return {
        authenticated: false,
        error: 'Invalid or expired token'
      };
    }

    // Verificar rate limit
    const rateLimitResult = rateLimit(user.id);
    if (!rateLimitResult.allowed) {
      return {
        authenticated: false,
        error: 'Rate limit exceeded',
        rateLimitExceeded: true,
        retryAfter: rateLimitResult.resetIn
      };
    }

    return {
      authenticated: true,
      user,
      rateLimit: rateLimitResult
    };
  } catch (error) {
    return {
      authenticated: false,
      error: 'Authentication failed'
    };
  }
}

// Headers CORS seguros
function getCorsHeaders(origin) {
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_SITE_URL,
    'http://localhost:3000',
    'https://localhost:3000',
    /\.netlify\.app$/
  ];

  // Verificar si el origin está permitido
  const isAllowed = allowedOrigins.some(allowed => {
    if (typeof allowed === 'string') {
      return origin === allowed;
    }
    if (allowed instanceof RegExp) {
      return allowed.test(origin);
    }
    return false;
  });

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

module.exports = {
  verifyAuth,
  getCorsHeaders
};
