const ML_CONFIG = {
  client_id: process.env.ML_CLIENT_ID,
  client_secret: process.env.ML_CLIENT_SECRET,
  redirect_uri: process.env.ML_REDIRECT_URI,
  api_base: process.env.ML_API_BASE || 'https://api.mercadolibre.com',
  auth_base: process.env.ML_AUTH_BASE || 'https://auth.mercadolibre.cl',
  country: process.env.ML_COUNTRY || 'CL',
  
  // Endpoints específicos para Chile
  endpoints: {
    auth: 'https://auth.mercadolibre.cl/authorization',
    token: 'https://api.mercadolibre.com/oauth/token',
    orders: 'https://api.mercadolibre.com/orders',
    users: 'https://api.mercadolibre.com/users',
    items: 'https://api.mercadolibre.com/items',
    messages: 'https://api.mercadolibre.com/messages',
    shipments: 'https://api.mercadolibre.com/shipments',
    notifications: 'https://api.mercadolibre.com/myfeeds'
  },

  // Scopes disponibles basados en tu configuración
  scopes: [
    'read',
    'write',
    'offline_access'
  ],

  // Tópicos de webhook configurados
  webhook_topics: [
    'orders',
    'messages', 
    'items',
    'shipments',
    'promotions'
  ]
};

module.exports = ML_CONFIG;