require('dotenv').config();
const mlService = require('../../../lib/mercadolibre-service');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    console.log('🚀 Iniciando proceso de autorización con MercadoLibre...');
    
    // Generar URL de autorización
    const authUrl = mlService.getAuthUrl();
    
    console.log('✅ URL de autorización generada');
    
    // Responder con la URL o redirigir directamente
    if (req.query.redirect === 'true') {
      // Redirigir directamente a MercadoLibre
      res.redirect(302, authUrl);
    } else {
      // Devolver la URL para manejo en frontend
      res.status(200).json({
        success: true,
        auth_url: authUrl,
        message: 'URL de autorización generada correctamente'
      });
    }
    
  } catch (error) {
    console.error('❌ Error generando URL de autorización:', error);
    res.status(500).json({
      error: 'Error al generar URL de autorización',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}