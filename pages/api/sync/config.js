// pages/api/sync/config.js - Configuración granular de sincronización
import { supabase } from '../../../lib/supabaseClient';
import { requireAdminForPOST } from '../../../lib/simpleAdminAuth';

export default requireAdminForPOST(async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            return await getSyncConfig(req, res);
        } catch (error) {
            console.error('Error obteniendo configuración de sincronización:', error);
            return res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    
    if (req.method === 'POST') {
        try {
            return await updateSyncConfig(req, res);
        } catch (error) {
            console.error('Error actualizando configuración de sincronización:', error);
            return res.status(500).json({ 
                error: 'Error interno del servidor',
                details: error.message 
            });
        }
    }
    
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
});

// Obtener configuración actual de sincronización
async function getSyncConfig(req, res) {
    try {
        // Obtener configuraciones de API
        const { data: apiConfigs } = await supabase
            .from('api_configurations')
            .select('*')
            .eq('active', true);

        // Configuración por defecto
        const defaultConfig = {
            mercadolibre: {
                enabled: false,
                sync_inventory: true,
                sync_sales: true,
                sync_orders: true,
                auto_sync_interval: 60, // minutos
                sync_settings: {
                    update_stock: true,
                    update_prices: false,
                    import_new_orders: true,
                    create_products: true,
                    pause_out_of_stock: false
                }
            },
            defontana: {
                enabled: false,
                sync_inventory: false,
                sync_invoices: true,
                auto_invoice_creation: false,
                sync_settings: {
                    auto_create_invoices: false,
                    sync_customers: true,
                    update_product_costs: false,
                    export_accounting_data: true
                }
            },
            global_settings: {
                bulk_upload_mode: 'coexist', // 'coexist', 'api_only', 'bulk_only'
                conflict_resolution: 'api_priority', // 'api_priority', 'manual_review'
                sync_frequency: 'manual', // 'manual', 'hourly', 'daily'
                notification_email: null,
                max_sync_errors: 10
            }
        };

        // Buscar configuración guardada
        const { data: savedConfig } = await supabase
            .from('api_configurations')
            .select('config')
            .eq('api_name', 'sync_settings')
            .single();

        const currentConfig = savedConfig?.config || defaultConfig;

        // Agregar estado de APIs
        const mlConfig = apiConfigs.find(c => c.api_name === 'mercadolibre');
        const dfConfig = apiConfigs.find(c => c.api_name === 'defontana');

        currentConfig.mercadolibre.available = !!mlConfig;
        currentConfig.defontana.available = !!dfConfig;

        return res.json({
            success: true,
            config: currentConfig,
            apis_configured: {
                mercadolibre: !!mlConfig,
                defontana: !!dfConfig
            }
        });

    } catch (error) {
        console.error('Error obteniendo configuración de sync:', error);
        return res.status(500).json({ error: 'Error obteniendo configuración' });
    }
}

// Actualizar configuración de sincronización
async function updateSyncConfig(req, res) {
    const { config } = req.body;

    if (!config) {
        return res.status(400).json({ error: 'Configuración requerida' });
    }

    try {
        // Validar configuración
        const validatedConfig = validateSyncConfig(config);

        // Guardar configuración
        await supabase
            .from('api_configurations')
            .upsert({
                api_name: 'sync_settings',
                config: validatedConfig,
                active: true,
                updated_at: new Date().toISOString()
            });

        // Log del cambio
        await supabase.from('sync_logs').insert({
            platform: 'system',
            sync_type: 'config_update',
            results: {
                message: 'Configuración de sincronización actualizada',
                user_id: req.user?.id,
                changes: validatedConfig
            },
            created_at: new Date().toISOString()
        });

        console.log('✅ Configuración de sincronización actualizada');

        return res.json({
            success: true,
            message: 'Configuración actualizada exitosamente',
            config: validatedConfig
        });

    } catch (error) {
        console.error('Error actualizando configuración de sync:', error);
        return res.status(500).json({ 
            error: 'Error actualizando configuración',
            details: error.message 
        });
    }
}

// Validar configuración de sincronización
function validateSyncConfig(config) {
    const validated = { ...config };

    // Validar configuración de MercadoLibre
    if (validated.mercadolibre) {
        validated.mercadolibre.auto_sync_interval = Math.max(5, Math.min(1440, validated.mercadolibre.auto_sync_interval || 60));
    }

    // Validar configuración global
    if (validated.global_settings) {
        const validModes = ['coexist', 'api_only', 'bulk_only'];
        if (!validModes.includes(validated.global_settings.bulk_upload_mode)) {
            validated.global_settings.bulk_upload_mode = 'coexist';
        }

        const validResolutions = ['api_priority', 'manual_review'];
        if (!validResolutions.includes(validated.global_settings.conflict_resolution)) {
            validated.global_settings.conflict_resolution = 'api_priority';
        }

        const validFrequencies = ['manual', 'hourly', 'daily'];
        if (!validFrequencies.includes(validated.global_settings.sync_frequency)) {
            validated.global_settings.sync_frequency = 'manual';
        }

        validated.global_settings.max_sync_errors = Math.max(1, Math.min(100, validated.global_settings.max_sync_errors || 10));
    }

    return validated;
}