// pages/api/test/mercadolibre.js - Endpoint para probar y diagnosticar MercadoLibre API
import { getAPIConfig } from '../../../lib/apiClients';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 1. Verificar variables de entorno
        const envCheck = {
            MERCADOLIBRE_APP_ID: !!process.env.NEXT_PUBLIC_MERCADOLIBRE_APP_ID,
            MERCADOLIBRE_CLIENT_SECRET: !!process.env.MERCADOLIBRE_CLIENT_SECRET,
            app_id_value: process.env.NEXT_PUBLIC_MERCADOLIBRE_APP_ID ? 'Set' : 'Not set',
            client_secret_value: process.env.MERCADOLIBRE_CLIENT_SECRET ? 'Set' : 'Not set'
        };

        console.log('🔍 Environment variables check:', envCheck);

        // 2. Verificar configuración en base de datos
        const config = await getAPIConfig('mercadolibre');
        
        const configCheck = {
            configured: !!config,
            active: config?.active || false,
            has_access_token: !!(config?.config?.access_token),
            has_refresh_token: !!(config?.config?.refresh_token),
            user_id: config?.config?.user_id || null,
            nickname: config?.config?.nickname || null,
            configured_at: config?.config?.configured_at || null
        };

        console.log('🔍 Database config check:', configCheck);

        // 3. Si hay configuración, probar una request simple
        let apiTest = { attempted: false };
        
        if (config && config.config && config.config.access_token) {
            try {
                console.log('🧪 Attempting API test...');
                apiTest.attempted = true;
                
                // Probar endpoint simple de países (no requiere autenticación específica)
                const testResponse = await fetch('https://api.mercadolibre.com/sites', {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'SistemaGestion/1.0'
                    }
                });
                
                if (testResponse.ok) {
                    const sites = await testResponse.json();
                    apiTest.public_endpoint = {
                        success: true,
                        sites_count: sites.length
                    };
                } else {
                    apiTest.public_endpoint = {
                        success: false,
                        status: testResponse.status,
                        error: await testResponse.text()
                    };
                }

                // Probar endpoint que requiere autenticación
                const authResponse = await fetch('https://api.mercadolibre.com/users/me', {
                    headers: {
                        'Authorization': `Bearer ${config.config.access_token}`,
                        'Accept': 'application/json',
                        'User-Agent': 'SistemaGestion/1.0'
                    }
                });

                if (authResponse.ok) {
                    const userInfo = await authResponse.json();
                    apiTest.authenticated_endpoint = {
                        success: true,
                        user_id: userInfo.id,
                        nickname: userInfo.nickname
                    };
                } else {
                    const errorText = await authResponse.text();
                    apiTest.authenticated_endpoint = {
                        success: false,
                        status: authResponse.status,
                        error: errorText
                    };
                }

            } catch (testError) {
                console.error('🚨 API Test Error:', testError);
                apiTest.error = testError.message;
            }
        }

        // 4. Diagnóstico y recomendaciones
        const diagnostics = [];
        
        if (!envCheck.MERCADOLIBRE_APP_ID) {
            diagnostics.push({
                type: 'error',
                message: 'Variable NEXT_PUBLIC_MERCADOLIBRE_APP_ID no configurada',
                solution: 'Agregar la variable de entorno con tu App ID de MercadoLibre'
            });
        }
        
        if (!envCheck.MERCADOLIBRE_CLIENT_SECRET) {
            diagnostics.push({
                type: 'error',
                message: 'Variable MERCADOLIBRE_CLIENT_SECRET no configurada',
                solution: 'Agregar la variable de entorno con tu Client Secret de MercadoLibre'
            });
        }
        
        if (!configCheck.configured) {
            diagnostics.push({
                type: 'warning',
                message: 'MercadoLibre no está configurado en la base de datos',
                solution: 'Completar el flujo OAuth en la página de configuración'
            });
        } else if (!configCheck.active) {
            diagnostics.push({
                type: 'warning',
                message: 'Configuración de MercadoLibre está inactiva',
                solution: 'Reactivar la configuración o reconectar'
            });
        }
        
        if (configCheck.configured && !configCheck.has_access_token) {
            diagnostics.push({
                type: 'error',
                message: 'Configuración existe pero falta access_token',
                solution: 'Repetir el proceso de autorización OAuth'
            });
        }

        if (apiTest.attempted && apiTest.authenticated_endpoint && !apiTest.authenticated_endpoint.success) {
            if (apiTest.authenticated_endpoint.status === 401) {
                diagnostics.push({
                    type: 'error',
                    message: 'Token de acceso expirado o inválido',
                    solution: 'Refrescar el token o reautenticar'
                });
            } else {
                diagnostics.push({
                    type: 'error',
                    message: `Error API: ${apiTest.authenticated_endpoint.error}`,
                    solution: 'Revisar permisos de la aplicación en MercadoLibre'
                });
            }
        }

        return res.json({
            status: 'diagnosis_complete',
            timestamp: new Date().toISOString(),
            environment_variables: envCheck,
            database_config: configCheck,
            api_tests: apiTest,
            diagnostics: diagnostics,
            next_steps: diagnostics.length > 0 ? diagnostics : [{
                type: 'success',
                message: 'Configuración parece correcta',
                solution: 'Probar funcionalidades de sync'
            }]
        });

    } catch (error) {
        console.error('🚨 Diagnostic Error:', error);
        return res.status(500).json({
            error: 'Error running diagnostics',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
}