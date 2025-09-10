// pages/api/auth/mercadolibre.js - Autenticación OAuth para MercadoLibre
import { MercadoLibreClient, saveAPIConfig } from '../../../lib/apiClients';
import { requireAdminForPOST } from '../../../lib/simpleAdminAuth';

export default requireAdminForPOST(async function handler(req, res) {
    if (req.method === 'GET') {
        // Paso 1: Generar URL de autorización
        const { action } = req.query;
        
        if (action === 'authorize') {
            try {
                const client = new MercadoLibreClient();
                const redirectURI = `${req.headers.origin}/api/auth/mercadolibre?action=callback`;
                const authURL = client.getAuthURL(redirectURI);
                
                return res.redirect(authURL);
            } catch (error) {
                console.error('Error generando URL de autorización:', error);
                return res.status(500).json({ error: 'Error iniciando autorización' });
            }
        }
        
        // Paso 2: Callback - intercambiar código por token
        if (action === 'callback') {
            const { code, error, state } = req.query;
            
            if (error) {
                console.error('Error en callback de MercadoLibre:', error);
                return res.redirect('/api-config?error=authorization_denied');
            }
            
            if (!code) {
                return res.redirect('/api-config?error=no_code');
            }
            
            try {
                const client = new MercadoLibreClient();
                const redirectURI = `${req.headers.origin}/api/auth/mercadolibre?action=callback`;
                
                // Intercambiar código por tokens
                const tokenData = await client.getAccessToken(code, redirectURI);
                
                // Obtener información del usuario
                const tempClient = new MercadoLibreClient(tokenData.access_token, tokenData.refresh_token);
                const userInfo = await tempClient.getUserInfo();
                
                // Guardar configuración en la base de datos
                await saveAPIConfig('mercadolibre', {
                    access_token: tokenData.access_token,
                    refresh_token: tokenData.refresh_token,
                    token_type: tokenData.token_type,
                    expires_in: tokenData.expires_in,
                    scope: tokenData.scope,
                    user_id: userInfo.id,
                    nickname: userInfo.nickname,
                    email: userInfo.email,
                    configured_at: new Date().toISOString()
                });
                
                console.log('✅ MercadoLibre configurado exitosamente para:', userInfo.nickname);
                
                return res.redirect('/api-config?success=mercadolibre_configured');
                
            } catch (error) {
                console.error('Error procesando callback de MercadoLibre:', error);
                return res.redirect('/api-config?error=token_exchange_failed');
            }
        }
        
        return res.status(400).json({ error: 'Acción no válida' });
    }
    
    if (req.method === 'POST') {
        // Desconectar/revocar autorización
        const { action } = req.body;
        
        if (action === 'disconnect') {
            try {
                // Marcar configuración como inactiva
                await saveAPIConfig('mercadolibre', {
                    active: false,
                    disconnected_at: new Date().toISOString()
                });
                
                return res.json({ 
                    success: true, 
                    message: 'MercadoLibre desconectado exitosamente' 
                });
                
            } catch (error) {
                console.error('Error desconectando MercadoLibre:', error);
                return res.status(500).json({ error: 'Error desconectando MercadoLibre' });
            }
        }
        
        return res.status(400).json({ error: 'Acción no válida' });
    }
    
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
});