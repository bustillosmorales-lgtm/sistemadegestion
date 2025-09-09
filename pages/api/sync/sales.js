// pages/api/sync/sales.js - Sincronización de ventas con APIs externas
import { supabase } from '../../../lib/supabaseClient';
import { createMercadoLibreClient, createDefontanaClient } from '../../../lib/apiClients';

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { action, platform, from_date, to_date, order_id } = req.body;
        
        try {
            if (action === 'sync_orders') {
                return await syncOrders(req, res, platform, from_date, to_date);
            }
            
            if (action === 'sync_single_order') {
                return await syncSingleOrder(req, res, platform, order_id);
            }
            
            if (action === 'create_invoice') {
                return await createInvoiceInDefontana(req, res, order_id);
            }
            
            return res.status(400).json({ error: 'Acción no válida' });
            
        } catch (error) {
            console.error('Error en sincronización de ventas:', error);
            return res.status(500).json({ 
                error: 'Error interno del servidor',
                details: error.message 
            });
        }
    }
    
    if (req.method === 'GET') {
        try {
            return await getSalesSync(req, res);
        } catch (error) {
            console.error('Error obteniendo sincronización de ventas:', error);
            return res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
}

// Sincronizar órdenes/ventas desde plataforma
async function syncOrders(req, res, platform, fromDate, toDate) {
    try {
        console.log(`🛒 Sincronizando órdenes de ${platform} desde ${fromDate} hasta ${toDate}`);
        
        let syncResults = {
            success: 0,
            errors: 0,
            duplicates: 0,
            details: []
        };
        
        if (platform === 'mercadolibre') {
            const client = await createMercadoLibreClient();
            const userInfo = await client.getUserInfo();
            
            // Obtener órdenes paginadas
            let offset = 0;
            const limit = 50;
            let hasMore = true;
            
            while (hasMore) {
                try {
                    const orders = await client.getOrders(userInfo.id, offset, limit);
                    
                    if (!orders.results || orders.results.length === 0) {
                        hasMore = false;
                        break;
                    }
                    
                    for (const order of orders.results) {
                        try {
                            // Filtrar por fechas si se especificaron
                            const orderDate = new Date(order.date_created);
                            if (fromDate && orderDate < new Date(fromDate)) continue;
                            if (toDate && orderDate > new Date(toDate)) continue;
                            
                            await processOrder(order, 'mercadolibre', syncResults);
                            
                        } catch (orderError) {
                            syncResults.errors++;
                            syncResults.details.push({
                                order_id: order.id,
                                status: 'error',
                                error: orderError.message
                            });
                        }
                    }
                    
                    offset += limit;
                    if (orders.results.length < limit) {
                        hasMore = false;
                    }
                    
                } catch (paginationError) {
                    console.error('Error en paginación de órdenes:', paginationError);
                    hasMore = false;
                }
            }
        }
        
        if (platform === 'defontana') {
            // Para Defontana, normalmente sincronizaríamos facturas hacia MercadoLibre
            // En este caso, podríamos obtener facturas recientes y marcarlas como procesadas
            const client = await createDefontanaClient();
            const invoices = await client.getInvoices(fromDate, toDate);
            
            for (const invoice of invoices.data || invoices || []) {
                try {
                    await processDefontanaInvoice(invoice, syncResults);
                } catch (invoiceError) {
                    syncResults.errors++;
                    syncResults.details.push({
                        invoice_id: invoice.id,
                        status: 'error',
                        error: invoiceError.message
                    });
                }
            }
        }
        
        // Guardar log de sincronización
        await supabase.from('sync_logs').insert({
            platform: platform,
            sync_type: 'sales_sync',
            date_from: fromDate,
            date_to: toDate,
            results: syncResults,
            created_at: new Date().toISOString()
        });
        
        console.log(`✅ Sincronización de ventas completa: ${syncResults.success} exitosos, ${syncResults.errors} errores, ${syncResults.duplicates} duplicados`);
        
        return res.json({
            success: true,
            message: `Sincronización de ventas de ${platform} completada`,
            results: syncResults
        });
        
    } catch (error) {
        console.error(`Error sincronizando órdenes de ${platform}:`, error);
        return res.status(500).json({ 
            error: `Error sincronizando órdenes`,
            details: error.message 
        });
    }
}

// Procesar una orden individual
async function processOrder(order, platform, syncResults) {
    try {
        // Verificar si la orden ya existe
        const { data: existingOrder } = await supabase
            .from('external_orders')
            .select('id')
            .eq('platform', platform)
            .eq('external_id', order.id.toString())
            .single();
            
        if (existingOrder) {
            syncResults.duplicates++;
            syncResults.details.push({
                order_id: order.id,
                status: 'duplicate'
            });
            return;
        }
        
        // Procesar cada item de la orden
        for (const item of order.order_items || []) {
            // Buscar mapeo del producto
            const { data: mapping } = await supabase
                .from('platform_mappings')
                .select('internal_sku')
                .eq('platform', platform)
                .eq('external_id', item.item.id)
                .single();
                
            const sku = mapping?.internal_sku || item.item.seller_custom_field || item.item.id;
            
            // Verificar/crear producto si no existe
            await ensureProductExists(sku, item.item);
            
            // Crear registro de venta
            await supabase.from('ventas').insert({
                sku: sku,
                cantidad: item.quantity,
                fecha_venta: order.date_created,
                precio_venta_clp: item.unit_price,
                canal: platform,
                numero_venta: `${platform.toUpperCase()}-${order.id}`,
                external_order_id: order.id,
                buyer_info: {
                    id: order.buyer?.id,
                    nickname: order.buyer?.nickname
                }
            });
        }
        
        // Guardar información completa de la orden
        await supabase.from('external_orders').insert({
            platform: platform,
            external_id: order.id.toString(),
            order_data: order,
            status: order.status,
            total_amount: order.total_amount,
            date_created: order.date_created,
            processed_at: new Date().toISOString()
        });
        
        syncResults.success++;
        syncResults.details.push({
            order_id: order.id,
            status: 'success',
            items: order.order_items?.length || 0
        });
        
    } catch (error) {
        throw new Error(`Error procesando orden ${order.id}: ${error.message}`);
    }
}

// Procesar factura de Defontana
async function processDefontanaInvoice(invoice, syncResults) {
    try {
        // Lógica para procesar facturas desde Defontana
        // Esto dependerá de la estructura específica de las facturas de Defontana
        
        syncResults.success++;
        syncResults.details.push({
            invoice_id: invoice.id,
            status: 'success'
        });
        
    } catch (error) {
        throw new Error(`Error procesando factura ${invoice.id}: ${error.message}`);
    }
}

// Asegurar que el producto existe en nuestra base de datos
async function ensureProductExists(sku, itemData) {
    const { data: existingProduct } = await supabase
        .from('products')
        .select('sku')
        .eq('sku', sku)
        .single();
        
    if (!existingProduct) {
        // Crear producto automáticamente
        await supabase.from('products').insert({
            sku: sku,
            descripcion: itemData.title || `Producto ${sku} (Auto-creado)`,
            stock_actual: 0,
            status: 'ACTIVE',
            link: itemData.permalink,
            costo_fob_rmb: 1.0,
            cbm: 0.01,
            categoria: itemData.category_id || 'Sin categoría'
        });
        
        console.log(`📦 Producto auto-creado: ${sku} - ${itemData.title}`);
    }
}

// Crear factura en Defontana
async function createInvoiceInDefontana(req, res, orderId) {
    try {
        // Obtener información de la venta
        const { data: sale } = await supabase
            .from('ventas')
            .select(`
                *,
                products!ventas_sku_fkey(descripcion, costo_fob_rmb)
            `)
            .eq('numero_venta', orderId)
            .single();
            
        if (!sale) {
            return res.status(404).json({ error: 'Venta no encontrada' });
        }
        
        const client = await createDefontanaClient();
        
        // Preparar datos de factura para Defontana
        const invoiceData = {
            customer: {
                // Datos del cliente - obtener de external_orders si está disponible
                name: sale.buyer_info?.nickname || 'Cliente ML',
                email: sale.buyer_info?.email || 'noemail@mercadolibre.com'
            },
            items: [{
                description: sale.products.descripcion,
                quantity: sale.cantidad,
                unit_price: sale.precio_venta_clp,
                sku: sale.sku
            }],
            date: sale.fecha_venta,
            payment_method: 'MercadoLibre',
            notes: `Venta importada desde MercadoLibre - Orden: ${orderId}`
        };
        
        const result = await client.createInvoice(invoiceData);
        
        // Actualizar venta con información de facturación
        await supabase
            .from('ventas')
            .update({
                defontana_invoice_id: result.id,
                invoiced_at: new Date().toISOString()
            })
            .eq('numero_venta', orderId);
            
        return res.json({
            success: true,
            message: 'Factura creada en Defontana',
            invoice_id: result.id,
            sale_id: orderId
        });
        
    } catch (error) {
        console.error('Error creando factura en Defontana:', error);
        return res.status(500).json({ 
            error: 'Error creando factura',
            details: error.message 
        });
    }
}

// Obtener estado de sincronización de ventas
async function getSalesSync(req, res) {
    try {
        // Obtener estadísticas de órdenes sincronizadas
        const { data: orderStats } = await supabase
            .from('external_orders')
            .select('platform, processed_at')
            .order('processed_at', { ascending: false })
            .limit(100);
            
        const { data: recentSales } = await supabase
            .from('ventas')
            .select('canal, fecha_venta, numero_venta')
            .not('canal', 'is', null)
            .order('fecha_venta', { ascending: false })
            .limit(20);
            
        const stats = {
            mercadolibre: {
                total_orders: 0,
                last_sync: null
            },
            defontana: {
                total_invoices: 0,
                last_sync: null
            },
            recent_sales: recentSales || []
        };
        
        for (const order of orderStats || []) {
            if (stats[order.platform]) {
                stats[order.platform].total_orders++;
                if (!stats[order.platform].last_sync || order.processed_at > stats[order.platform].last_sync) {
                    stats[order.platform].last_sync = order.processed_at;
                }
            }
        }
        
        return res.json({ success: true, stats });
        
    } catch (error) {
        console.error('Error obteniendo estadísticas de ventas:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Sincronizar una orden específica
async function syncSingleOrder(req, res, platform, orderId) {
    if (!orderId) {
        return res.status(400).json({ error: 'order_id es requerido' });
    }
    
    try {
        let syncResults = { success: 0, errors: 0, details: [] };
        
        if (platform === 'mercadolibre') {
            const client = await createMercadoLibreClient();
            const order = await client.request(`/orders/${orderId}`);
            await processOrder(order, platform, syncResults);
        }
        
        return res.json({
            success: true,
            message: `Orden ${orderId} sincronizada`,
            results: syncResults
        });
        
    } catch (error) {
        console.error(`Error sincronizando orden ${orderId}:`, error);
        return res.status(500).json({ 
            error: 'Error sincronizando orden',
            details: error.message 
        });
    }
}