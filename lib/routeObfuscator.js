// Ofuscador de rutas críticas del sistema
import CryptoJS from 'crypto-js';

// Mapeo de rutas reales a rutas ofuscadas
const ROUTE_MAP = {
  '/api/users': '/api/u7x9k2m',
  '/api/auth': '/api/a4h8n1p',
  '/api/products': '/api/p6d3w9q',
  '/api/analysis': '/api/n2k7r5t',
  '/api/config': '/api/c9x4j8l',
  '/api/dashboard-stats': '/api/d5h2m8k',
  '/dashboard': '/d4s7h9b',
  '/users': '/u8k3n6m',
  '/config': '/c2r9x5t',
  '/contenedores': '/k7m4p8w'
};

// Mapeo inverso para el servidor
const REVERSE_ROUTE_MAP = Object.fromEntries(
  Object.entries(ROUTE_MAP).map(([real, obfuscated]) => [obfuscated, real])
);

// Generar hash de ruta dinámico basado en sesión
const generateRouteHash = (route, sessionToken) => {
  const hash = CryptoJS.SHA256(`${route}-${sessionToken}-sistemadegestion`).toString();
  return hash.substring(0, 8);
};

// Ofuscar URL para el cliente
export const obfuscateRoute = (route, sessionToken = null) => {
  // Usar mapeo estático o generar hash dinámico
  if (ROUTE_MAP[route]) {
    return ROUTE_MAP[route];
  }

  if (sessionToken) {
    const hash = generateRouteHash(route, sessionToken);
    return route.replace(/\/api\/([^\/]+)/, `/api/${hash}`);
  }

  return route;
};

// Deofuscar URL en el servidor
export const deobfuscateRoute = (obfuscatedRoute) => {
  return REVERSE_ROUTE_MAP[obfuscatedRoute] || obfuscatedRoute;
};

// Wrapper para fetch con rutas ofuscadas
export const secureApiFetch = async (route, options = {}, sessionToken = null) => {
  const obfuscatedRoute = obfuscateRoute(route, sessionToken);

  const secureOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Route-Hash': CryptoJS.SHA256(route).toString().substring(0, 16),
      ...options.headers
    }
  };

  // Agregar timestamp para evitar cache
  const separator = obfuscatedRoute.includes('?') ? '&' : '?';
  const finalRoute = `${obfuscatedRoute}${separator}_t=${Date.now()}`;

  try {
    const response = await fetch(finalRoute, secureOptions);

    // Validar headers de respuesta
    const serverHash = response.headers.get('X-Server-Hash');
    if (serverHash) {
      const expectedHash = CryptoJS.SHA256(`${route}-response`).toString().substring(0, 16);
      if (serverHash !== expectedHash) {
        throw new Error('Response integrity check failed');
      }
    }

    return response;
  } catch (error) {
    console.error('Secure API fetch failed:', error);
    throw error;
  }
};

// Middleware para Next.js que maneja deofuscación
export const routeDeobfuscationMiddleware = (req, res, next) => {
  const originalUrl = req.url;
  const deobfuscatedUrl = deobfuscateRoute(originalUrl);

  if (deobfuscatedUrl !== originalUrl) {
    req.url = deobfuscatedUrl;
    req.originalObfuscatedUrl = originalUrl;
  }

  // Agregar header de validación
  res.setHeader('X-Server-Hash',
    CryptoJS.SHA256(`${req.url}-response`).toString().substring(0, 16)
  );

  if (next) next();
};

// Generar rutas dinámicas para frontend
export const generateDynamicRoutes = (sessionId) => {
  const routes = {};

  Object.keys(ROUTE_MAP).forEach(realRoute => {
    const dynamicHash = generateRouteHash(realRoute, sessionId);
    routes[realRoute] = `/api/${dynamicHash}`;
  });

  return routes;
};

// Validar que la ruta viene de origen legítimo
export const validateRouteOrigin = (req) => {
  const routeHash = req.headers['x-route-hash'];
  const referer = req.headers.referer;
  const userAgent = req.headers['user-agent'];

  // Validar que tiene los headers esperados
  if (!routeHash) {
    return false;
  }

  // Validar que viene del dominio correcto
  if (referer && !referer.includes('sistemadegestion.net')) {
    return false;
  }

  // Validar User-Agent (no debe ser bot o herramienta)
  const suspiciousAgents = ['curl', 'wget', 'python', 'postman', 'bot', 'crawler'];
  if (suspiciousAgents.some(agent => userAgent?.toLowerCase().includes(agent))) {
    return false;
  }

  return true;
};