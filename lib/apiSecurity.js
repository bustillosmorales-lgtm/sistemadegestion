// Seguridad avanzada para API endpoints
import CryptoJS from 'crypto-js';

// Generar token de sesión seguro
const generateSessionToken = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  const userAgent = typeof window !== 'undefined' ? navigator.userAgent : 'server';

  return CryptoJS.SHA256(`${timestamp}-${random}-${userAgent}`).toString();
};

// Cifrar payload de requests críticos
export const encryptPayload = (data, endpoint) => {
  try {
    const sessionKey = generateSessionToken();
    const payload = {
      data: CryptoJS.AES.encrypt(JSON.stringify(data), sessionKey).toString(),
      timestamp: Date.now(),
      endpoint: CryptoJS.SHA256(endpoint).toString().substring(0, 16),
      checksum: CryptoJS.SHA256(JSON.stringify(data)).toString()
    };

    return {
      payload: btoa(JSON.stringify(payload)),
      key: sessionKey
    };
  } catch (e) {
    return { payload: data, key: null };
  }
};

// Descifrar response de API
export const decryptResponse = (encryptedData, key) => {
  try {
    const decoded = JSON.parse(atob(encryptedData));
    const decrypted = CryptoJS.AES.decrypt(decoded.data, key);
    return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
  } catch (e) {
    return encryptedData;
  }
};

// Validar integridad de requests
export const validateRequestIntegrity = (data, checksum) => {
  const calculatedChecksum = CryptoJS.SHA256(JSON.stringify(data)).toString();
  return calculatedChecksum === checksum;
};

// Rate limiting por IP y endpoint
const requestCounts = new Map();
const RATE_LIMITS = {
  '/api/auth': { max: 5, window: 300000 }, // 5 requests per 5 minutes
  '/api/products': { max: 100, window: 60000 }, // 100 requests per minute
  '/api/analysis': { max: 10, window: 60000 }, // 10 requests per minute
  '/api/users': { max: 20, window: 60000 }, // 20 requests per minute
  default: { max: 50, window: 60000 } // Default limit
};

export const checkRateLimit = (ip, endpoint) => {
  const key = `${ip}-${endpoint}`;
  const now = Date.now();
  const limit = RATE_LIMITS[endpoint] || RATE_LIMITS.default;

  if (!requestCounts.has(key)) {
    requestCounts.set(key, { count: 1, firstRequest: now });
    return { allowed: true, remaining: limit.max - 1 };
  }

  const record = requestCounts.get(key);

  // Reset if window has passed
  if (now - record.firstRequest > limit.window) {
    requestCounts.set(key, { count: 1, firstRequest: now });
    return { allowed: true, remaining: limit.max - 1 };
  }

  // Check if limit exceeded
  if (record.count >= limit.max) {
    return { allowed: false, remaining: 0, resetTime: record.firstRequest + limit.window };
  }

  // Increment count
  record.count++;
  return { allowed: true, remaining: limit.max - record.count };
};

// Generar fingerprint del cliente
export const generateClientFingerprint = () => {
  if (typeof window === 'undefined') return 'server';

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('Fingerprint test', 2, 2);

  const fingerprint = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack,
    screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    canvas: canvas.toDataURL(),
    plugins: Array.from(navigator.plugins).map(p => p.name).sort(),
    webgl: (() => {
      try {
        const gl = canvas.getContext('webgl');
        return gl.getParameter(gl.RENDERER);
      } catch (e) {
        return 'unavailable';
      }
    })()
  };

  return CryptoJS.SHA256(JSON.stringify(fingerprint)).toString();
};

// Detectar proxies y VPNs comunes
export const detectProxy = async (ip) => {
  // Lista de rangos de IPs conocidos de proxies/VPNs
  const proxyRanges = [
    /^10\./, /^172\.1[6-9]\./, /^172\.2[0-9]\./, /^172\.3[0-1]\./, /^192\.168\./,
    /^127\./, /^169\.254\./, /^::1$/, /^fc00:/, /^fe80:/
  ];

  return proxyRanges.some(range => range.test(ip));
};

// Middleware de seguridad para APIs críticas
export const securityMiddleware = (req, res, next) => {
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  const endpoint = req.url;
  const userAgent = req.headers['user-agent'] || '';

  // Rate limiting
  const rateLimitResult = checkRateLimit(clientIP, endpoint);
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      resetTime: rateLimitResult.resetTime
    });
  }

  // Headers de seguridad
  res.setHeader('X-Rate-Limit-Remaining', rateLimitResult.remaining);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  // Detectar bots y scrapers
  const suspiciousBots = [
    'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python-requests',
    'postman', 'insomnia', 'httpie'
  ];

  if (suspiciousBots.some(bot => userAgent.toLowerCase().includes(bot))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  next();
};