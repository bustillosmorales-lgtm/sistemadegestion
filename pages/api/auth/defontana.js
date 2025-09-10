// pages/api/auth/defontana.js - Configuración API de Defontana
import { DefontanaClient, saveAPIConfig, getAPIConfig } from '../../../lib/apiClients';
import { requireAdmin } from '../../../lib/adminAuth';

export default requireAdmin(async function handler(req, res) {
    if (req.method === 'POST') {
        const { action, apiKey, baseURL } = req.body;
        
        if (action === 'configure') {
            if (!apiKey) {
                return res.status(400).json({ error: 'API Key es requerida' });
            }
            
            try {
                // Probar la conexión con Defontana
                const client = new DefontanaClient(apiKey, baseURL);
                
                // Intentar obtener productos para validar la API Key
                try {
                    await client.getProducts();
                } catch (apiError) {
                    console.error('Error validando API Key de Defontana:', apiError);
                    return res.status(400).json({ 
                        error: 'API Key inválida o sin permisos. Verifica tus credenciales.' 
                    });
                }
                
                // Guardar configuración en la base de datos
                await saveAPIConfig('defontana', {
                    api_key: apiKey,
                    base_url: baseURL || 'https://www.defontana.com/api',
                    configured_at: new Date().toISOString()
                });
                
                console.log('✅ Defontana configurado exitosamente');
                
                return res.json({ 
                    success: true, 
                    message: 'Defontana configurado exitosamente' 
                });
                
            } catch (error) {
                console.error('Error configurando Defontana:', error);
                return res.status(500).json({ error: 'Error configurando Defontana' });
            }
        }
        
        if (action === 'disconnect') {
            try {
                // Marcar configuración como inactiva
                await saveAPIConfig('defontana', {
                    active: false,
                    disconnected_at: new Date().toISOString()
                });
                
                return res.json({ 
                    success: true, 
                    message: 'Defontana desconectado exitosamente' 
                });
                
            } catch (error) {
                console.error('Error desconectando Defontana:', error);
                return res.status(500).json({ error: 'Error desconectando Defontana' });
            }
        }
        
        if (action === 'test') {
            try {
                const client = new DefontanaClient(apiKey, baseURL);
                const products = await client.getProducts();
                
                return res.json({ 
                    success: true, 
                    message: 'Conexión exitosa con Defontana',
                    productCount: products.length || products.data?.length || 0
                });
                
            } catch (error) {
                console.error('Error probando conexión Defontana:', error);
                return res.status(400).json({ 
                    error: 'Error de conexión: ' + error.message 
                });
            }
        }
        
        return res.status(400).json({ error: 'Acción no válida' });
    }
    
    if (req.method === 'GET') {
        // Obtener estado actual de la configuración
        try {
            const config = await getAPIConfig('defontana');
            
            if (!config) {
                return res.json({ configured: false });
            }
            
            return res.json({ 
                configured: true,
                baseURL: config.config.base_url,
                configuredAt: config.config.configured_at,
                active: config.active
            });
            
        } catch (error) {
            console.error('Error obteniendo configuración Defontana:', error);
            return res.status(500).json({ error: 'Error obteniendo configuración' });
        }
    }
    
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
});