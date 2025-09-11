require('dotenv').config();
const mlService = require('../../../lib/mercadolibre-service');
const PKCEUtils = require('../../../lib/pkce-utils');
const supabase = require('../../../lib/supabase');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    console.log('🚀 Iniciando proceso de autorización con MercadoLibre (PKCE)...');
    
    // Generar PKCE parameters
    const pkce = PKCEUtils.generatePKCEPair();
    const sessionId = PKCEUtils.generateCodeVerifier(); // Usamos como session ID único
    
    console.log('🔐 PKCE generado:', { 
      challenge: pkce.codeChallenge.substring(0, 10) + '...', 
      method: pkce.codeChallengeMethod 
    });
    
    // Guardar code_verifier temporalmente en Supabase
    const { error: saveError } = await supabase
      .from('oauth_pkce_sessions')
      .insert({
        session_id: sessionId,
        code_verifier: pkce.codeVerifier,
        code_challenge: pkce.codeChallenge
      });
    
    if (saveError) {
      console.error('❌ Error guardando PKCE session:', saveError);
      throw new Error('Error al preparar autorización PKCE');
    }
    
    // Generar URL de autorización con PKCE
    const authUrl = mlService.getAuthUrlWithPKCE(pkce.codeChallenge, sessionId);
    
    console.log('✅ URL de autorización con PKCE generada');
    
    // Responder con la URL o redirigir directamente
    if (req.query.redirect === 'true') {
      // Redirigir directamente a MercadoLibre
      res.redirect(302, authUrl);
    } else {
      // Devolver la URL para manejo en frontend
      res.status(200).json({
        success: true,
        auth_url: authUrl,
        session_id: sessionId,
        message: 'URL de autorización con PKCE generada correctamente'
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