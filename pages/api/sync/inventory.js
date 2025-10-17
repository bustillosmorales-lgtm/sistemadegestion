// pages/api/sync/inventory.js - Sincronización de inventario con APIs externas
import { supabase } from '../../../lib/supabaseClient';
import { createMercadoLibreClient, createDefontanaClient } from '../../../lib/apiClients';
import { requireAdminForPOST } from '../../../lib/simpleAdminAuth';
import { optimizedSync, BatchProcessor, globalCache } from '../../../lib/syncOptimizer';

export default requireAdminForPOST(async function handler(req, res) {
    if (req.method === 'POST') {
        const { action, platform, sku, quantity, items } = req.body;
        
        try {
            if (action === 'update_stock') {
                return await updateStock(req, res, platform, sku, quantity);
            }
            
            if (action === 'sync_all') {
                return await syncAllInventory(req, res, platform);
            }
            
            if (action === 'bulk_update') {
                return await bulkUpdateStock(req, res, platform, items);
            }
            
            if (action === 'import_products') {
                return await importProductsFromPlatform(req, res, platform);
            }
            
            return res.status(400).json({ error: 'Acción no válida' });
            
        } catch (error) {
            console.error('Error en sincronización de inventario:', error);
            return res.status(500).json({ 
                error: 'Error interno del servidor',
                details: error.message 
            });
        }
    }
    
    if (req.method === 'GET') {
        const { platform, sku } = req.query;
        
        try {
            if (platform && sku) {
                return await getProductSync(req, res, platform, sku);
            }
            
            return await getSyncStatus(req, res);
            
        } catch (error) {
            console.error('Error obteniendo estado de sincronización:', error);
            return res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
});

// Actualizar stock en plataforma específica
async function updateStock(req, res, platform, sku, quantity) {
    if (!platform || !sku || quantity === undefined) {
        return res.status(400).json({ error: 'Parámetros requeridos: platform, sku, quantity' });
    }
    
    try {
        if (platform === 'mercadolibre') {
            const client = await createMercadoLibreClient();
            
            // Buscar el item por SKU en nuestro mapeo
            const { data: mapping } = await supabase
                .from('platform_mappings')
                .select('*')
                .eq('platform', 'mercadolibre')
                .eq('internal_sku', sku)
                .single();
                
            if (!mapping) {
                return res.status(404).json({ error: 'Producto no mapeado en MercadoLibre' });
            }
            
            const result = await client.updateItemStock(mapping.external_id, quantity);
            
            // Actualizar timestamp de última sincronización
            await supabase
                .from('platform_mappings')
                .update({ 
                    last_sync: new Date().toISOString(),
                    last_quantity: quantity 
                })
                .eq('id', mapping.id);
                
            return res.json({ 
                success: true, 
                platform: 'mercadolibre',
                sku: sku,
                quantity: quantity,
                result: result 
            });
        }
        
        if (platform === 'defontana') {
            const client = await createDefontanaClient();
            
            // Buscar el producto por SKU
            const { data: mapping } = await supabase
                .from('platform_mappings')
                .select('*')
                .eq('platform', 'defontana')
                .eq('internal_sku', sku)
                .single();
                
            if (!mapping) {
                return res.status(404).json({ error: 'Producto no mapeado en Defontana' });
            }
            
            const result = await client.updateProductStock(mapping.external_id, quantity);
            
            // Actualizar timestamp de última sincronización
            await supabase
                .from('platform_mappings')
                .update({ 
                    last_sync: new Date().toISOString(),
                    last_quantity: quantity 
                })
                .eq('id', mapping.id);
                
            return res.json({ 
                success: true, 
                platform: 'defontana',
                sku: sku,
                quantity: quantity,
                result: result 
            });
        }
        
        return res.status(400).json({ error: 'Plataforma no soportada' });
        
    } catch (error) {
        console.error(`Error actualizando stock en ${platform}:`, error);
        return res.status(500).json({ 
            error: `Error actualizando stock en ${platform}`,
            details: error.message 
        });
    }
}

// Sincronizar todo el inventario
async function syncAllInventory(req, res, platform) {
    try {
        console.log(`🔄 Iniciando sincronización completa de inventario para ${platform}`);
        
        // Obtener todos los productos con stock actual
        const { data: products, error } = await supabase
            .from('products')
            .select('sku, stock_actual, descripcion')
            .not('desconsiderado', 'is', true);
            
        if (error) {
            throw new Error(`Error obteniendo productos: ${error.message}`);
        }
        
        let syncResults = {
            success: 0,
            errors: 0,
            skipped: 0,
            details: []
        };
        
        // Obtener mapeos para optimizar consultas
        const { data: mappings } = await supabase
            .from('platform_mappings')
            .select('*')
            .eq('platform', platform)
            .eq('active', true);
            
        const mappingMap = new Map(mappings.map(m => [m.internal_sku, m]));
        
        // Filtrar productos que tienen mapeo
        const mappedProducts = products.filter(product => mappingMap.has(product.sku));
        const skippedCount = products.length - mappedProducts.length;
        
        console.log(`📊 ${mappedProducts.length} productos mapeados, ${skippedCount} omitidos`);
        
        // Procesar con optimización
        const processor = async (product, options) => {
            const mapping = mappingMap.get(product.sku);
            return await updateStockDirect(platform, product.sku, product.stock_actual, mapping);
        };
        
        const optimizedResults = await optimizedSync(platform, mappedProducts, processor, {
            batchSize: 15,
            maxConcurrency: 2
        });
        
        // Consolidar resultados
        syncResults = {
            success: optimizedResults.success,
            errors: optimizedResults.errors,
            skipped: skippedCount,
            details: [
                ...optimizedResults.details,
                ...Array(skippedCount).fill(null).map((_, i) => ({
                    sku: products.find(p => !mappingMap.has(p.sku))?.sku || `skipped_${i}`,
                    status: 'skipped',
                    reason: 'No mapeado en plataforma'
                }))
            ]
        };
        
        console.log(`✅ Sincronización completa: ${syncResults.success} exitosos, ${syncResults.errors} errores, ${syncResults.skipped} omitidos`);
        
        // Guardar log de sincronización
        await supabase.from('sync_logs').insert({
            platform: platform,
            sync_type: 'inventory_sync_all',
            results: syncResults,
            created_at: new Date().toISOString()
        });
        
        return res.json({
            success: true,
            message: `Sincronización de ${platform} completada`,
            results: syncResults
        });
        
    } catch (error) {
        console.error(`Error en sincronización completa de ${platform}:`, error);
        return res.status(500).json({ 
            error: `Error en sincronización completa`,
            details: error.message 
        });
    }
}

// Función auxiliar para actualizar stock directamente
async function updateStockDirect(platform, sku, quantity, mapping) {
    if (platform === 'mercadolibre') {
        const client = await createMercadoLibreClient();
        await client.updateItemStock(mapping.external_id, quantity);
    } else if (platform === 'defontana') {
        const client = await createDefontanaClient();
        await client.updateProductStock(mapping.external_id, quantity);
    }
    
    // Actualizar timestamp de última sincronización
    await supabase
        .from('platform_mappings')
        .update({ 
            last_sync: new Date().toISOString(),
            last_quantity: quantity 
        })
        .eq('id', mapping.id);
}

// Obtener estado de sincronización
async function getSyncStatus(req, res) {
    try {
        // Obtener estadísticas de mapeos por plataforma
        const { data: mappings } = await supabase
            .from('platform_mappings')
            .select('platform, last_sync, active')
            .eq('active', true);
            
        const stats = {
            mercadolibre: {
                mapped_products: 0,
                last_sync: null,
                needs_sync: 0
            },
            defontana: {
                mapped_products: 0,
                last_sync: null,
                needs_sync: 0
            }
        };
        
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        for (const mapping of mappings || []) {
            if (stats[mapping.platform]) {
                stats[mapping.platform].mapped_products++;
                
                const lastSync = mapping.last_sync ? new Date(mapping.last_sync) : null;
                if (!stats[mapping.platform].last_sync || (lastSync && lastSync > new Date(stats[mapping.platform].last_sync))) {
                    stats[mapping.platform].last_sync = mapping.last_sync;
                }
                
                if (!lastSync || lastSync < oneDayAgo) {
                    stats[mapping.platform].needs_sync++;
                }
            }
        }
        
        return res.json({ success: true, stats });
        
    } catch (error) {
        console.error('Error obteniendo estado de sincronización:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Obtener información de sincronización de un producto específico
async function getProductSync(req, res, platform, sku) {
    try {
        const { data: mapping } = await supabase
            .from('platform_mappings')
            .select('*')
            .eq('platform', platform)
            .eq('internal_sku', sku)
            .single();
            
        if (!mapping) {
            return res.json({ 
                mapped: false, 
                sku: sku, 
                platform: platform 
            });
        }
        
        return res.json({ 
            mapped: true,
            sku: sku,
            platform: platform,
            external_id: mapping.external_id,
            last_sync: mapping.last_sync,
            last_quantity: mapping.last_quantity,
            active: mapping.active
        });
        
    } catch (error) {
        console.error('Error obteniendo información de producto:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Actualización masiva de stock
async function bulkUpdateStock(req, res, platform, items) {
    if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Items debe ser un array' });
    }
    
    let results = { success: 0, errors: 0, details: [] };
    
    for (const item of items) {
        try {
            await updateStockByMapping(platform, item.sku, item.quantity);
            results.success++;
            results.details.push({ sku: item.sku, status: 'success' });
        } catch (error) {
            results.errors++;
            results.details.push({ sku: item.sku, status: 'error', error: error.message });
        }
    }
    
    return res.json({ success: true, results });
}

// Importar productos desde plataforma externa
async function importProductsFromPlatform(req, res, platform) {
    try {
        console.log(`📥 Importando productos desde ${platform}`);
        
        let importedProducts = [];
        
        if (platform === 'mercadolibre') {
            const client = await createMercadoLibreClient();
            const userInfo = await client.getUserInfo();
            const items = await client.getItems(userInfo.id);
            
            for (const itemId of items.results || []) {
                try {
                    const item = await client.getItem(itemId);
                    const sku = item.seller_custom_field || itemId;

                    // Verificar si el producto existe en nuestra base de datos
                    const { data: existingProduct, error: checkError } = await supabase
                        .from('products')
                        .select('sku, descripcion')
                        .eq('sku', sku)
                        .maybeSingle();

                    if (checkError) {
                        throw new Error(`Error verificando producto ${sku}: ${checkError.message}`);
                    }

                    if (!existingProduct) {
                        console.warn(`⚠️ Producto ${sku} no existe en la tabla productos. Omitiendo importación.`);
                        console.warn(`   Debe crear este producto mediante carga masiva de productos primero.`);
                        continue; // Saltar este producto
                    }

                    // Solo actualizar stock si el producto existe
                    const { error: updateError } = await supabase
                        .from('products')
                        .update({
                            stock_actual: item.available_quantity,
                            status: item.status === 'active' ? 'ACTIVE' : 'INACTIVE',
                            link: item.permalink
                        })
                        .eq('sku', sku);

                    if (updateError) {
                        throw new Error(`Error actualizando producto ${sku}: ${updateError.message}`);
                    }

                    // Crear/actualizar mapeo
                    await supabase
                        .from('platform_mappings')
                        .upsert({
                            platform: 'mercadolibre',
                            internal_sku: sku,
                            external_id: itemId,
                            external_data: item,
                            active: true,
                            last_sync: new Date().toISOString()
                        });

                    importedProducts.push({
                        sku: sku,
                        descripcion: existingProduct.descripcion,
                        stock_actual: item.available_quantity,
                        status: item.status === 'active' ? 'ACTIVE' : 'INACTIVE',
                        link: item.permalink
                    });

                } catch (error) {
                    console.error(`Error importando item ${itemId}:`, error);
                }
            }
        }
        
        return res.json({ 
            success: true, 
            message: `${importedProducts.length} productos importados desde ${platform}`,
            products: importedProducts
        });
        
    } catch (error) {
        console.error(`Error importando productos desde ${platform}:`, error);
        return res.status(500).json({ 
            error: `Error importando desde ${platform}`,
            details: error.message 
        });
    }
}