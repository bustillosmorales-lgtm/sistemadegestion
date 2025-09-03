// pages/api/status.js
import { supabase } from '../../lib/supabaseClient';

const workflowOrder = [
    'NO_REPLENISHMENT_NEEDED', 'NEEDS_REPLENISHMENT', 'QUOTE_REQUESTED', 'QUOTED', 'QUOTED_PRICE_MODIFIED', 'ANALYZING',
    'PURCHASE_APPROVED', 'PURCHASE_CONFIRMED', 'MANUFACTURED', 'SHIPPED',
    'QUOTE_REJECTED'
];

export default async function handler(req, res) {
    console.log('🌐 API /api/status recibió petición');
    console.log('📋 Método:', req.method);
    console.log('📦 Body:', req.body);
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const { sku, nextStatus, payload } = req.body;
    console.log('🔍 Parámetros extraídos:', { sku, nextStatus, payload });
    
    if (!sku || !nextStatus) {
        console.log('❌ Faltan parámetros requeridos');
        return res.status(400).json({ error: 'Faltan los parámetros SKU y nextStatus.' });
    }

    // Buscar producto en Supabase
    const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('sku', sku)
        .single();
    
    console.log('🔍 Producto encontrado:', product ? `${product.sku} - ${product.descripcion}` : 'No encontrado');
    
    if (productError || !product) {
        console.log('❌ Producto no encontrado:', productError?.message);
        return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    const currentIndex = workflowOrder.indexOf(product.status);
    const nextIndex = workflowOrder.indexOf(nextStatus);
    console.log('📊 Transición:', `${product.status} (${currentIndex}) → ${nextStatus} (${nextIndex})`);
    
    // Permitir todas las transiciones del workflow secuencial
    const isValidTransition = 
        (nextIndex === currentIndex + 1) || // Transición secuencial normal
        (nextStatus === 'QUOTE_REJECTED' && product.status === 'ANALYZING') || // Rechazo desde análisis
        (nextStatus === 'QUOTED' && product.status === 'QUOTE_REJECTED') || // Re-cotizar después de rechazo
        // Transiciones específicas permitidas:
        (nextStatus === 'NEEDS_REPLENISHMENT' && product.status === 'NO_REPLENISHMENT_NEEDED') ||
        (nextStatus === 'QUOTE_REQUESTED' && product.status === 'NEEDS_REPLENISHMENT') ||
        (nextStatus === 'QUOTED' && product.status === 'QUOTE_REQUESTED') ||
        (nextStatus === 'ANALYZING' && product.status === 'QUOTED') ||
        (nextStatus === 'ANALYZING' && product.status === 'QUOTED_PRICE_MODIFIED') ||
        (nextStatus === 'PURCHASE_APPROVED' && product.status === 'ANALYZING') ||
        (nextStatus === 'PURCHASE_CONFIRMED' && product.status === 'PURCHASE_APPROVED') ||
        (nextStatus === 'MANUFACTURED' && product.status === 'PURCHASE_CONFIRMED') ||
        (nextStatus === 'SHIPPED' && product.status === 'MANUFACTURED');

    console.log('🚦 ¿Transición válida?', isValidTransition);
    
    if (isValidTransition) {
        console.log('✅ Transición permitida, actualizando datos...');
        
        // Preparar datos para actualizar
        let updateData = {
            status: nextStatus
        };
        
        // Agregar detalles específicos según el status actual con timestamps y datos completos
        const timestamp = new Date().toISOString();
        
        switch (product.status) {
            case 'NEEDS_REPLENISHMENT':
                updateData.request_details = {
                    ...payload,
                    timestamp,
                    previousStatus: product.status,
                    nextStatus,
                    sku: product.sku,
                    descripcion: product.descripcion
                };
                break;
                
            case 'QUOTE_REQUESTED':
            case 'QUOTE_REJECTED': // Re-cotización después de rechazo
                // Obtener configuración para cálculos
                const { data: configData } = await supabase.from('configuration').select('data').eq('id', 1).single();
                const config = configData?.data;
                
                let calculatedValues = {};
                if(payload.unitPrice && payload.currency && config) {
                    const price = parseFloat(payload.unitPrice);
                    let unitPriceUSD = 0;
                    if (payload.currency === 'RMB') {
                        unitPriceUSD = price * config.rmbToUsd;
                    } else { // Asume USD
                        unitPriceUSD = price;
                    }
                    calculatedValues.unitPriceUSD = unitPriceUSD;
                    calculatedValues.rmbToUsdRate = config.rmbToUsd;
                    updateData.costo_fob_rmb = unitPriceUSD / config.rmbToUsd;
                }
                if(payload.cbmPerBox && payload.unitsPerBox) {
                    calculatedValues.cbmPerUnit = parseFloat(payload.cbmPerBox) / parseFloat(payload.unitsPerBox);
                    updateData.cbm = calculatedValues.cbmPerUnit;
                }
                
                updateData.quote_details = {
                    ...payload,
                    ...calculatedValues,
                    timestamp,
                    previousStatus: product.status,
                    nextStatus,
                    configSnapshot: config ? {
                        rmbToUsd: config.rmbToUsd,
                        usdToClp: config.usdToClp
                    } : null
                };
                break;
                
            case 'QUOTED':
                updateData.analysis_details = {
                    ...payload,
                    timestamp,
                    previousStatus: product.status,
                    nextStatus,
                    currentStock: product.stock_actual,
                    currentCbm: product.cbm,
                    currentFobRmb: product.costo_fob_rmb
                };
                break;
                
            case 'ANALYZING':
                updateData.approval_details = {
                    ...payload,
                    timestamp,
                    previousStatus: product.status,
                    nextStatus,
                    // Incluir análisis completo si está disponible en el payload
                    analysisSnapshot: payload.analysisSnapshot || null
                };
                
                // Handle SKU change for auto-generated SKUs
                if (payload.newSku && payload.newSku !== sku) {
                    // Check if new SKU already exists
                    const { data: existingSku, error: skuCheckError } = await supabase
                        .from('products')
                        .select('sku')
                        .eq('sku', payload.newSku)
                        .single();
                    
                    if (existingSku) {
                        console.log('❌ SKU ya existe:', payload.newSku);
                        return res.status(400).json({ error: `El SKU ${payload.newSku} ya existe en el sistema.` });
                    }
                    
                    if (skuCheckError && skuCheckError.code !== 'PGRST116') {
                        console.log('❌ Error verificando SKU:', skuCheckError.message);
                        return res.status(500).json({ error: 'Error verificando la unicidad del SKU.' });
                    }
                    
                    // Update SKU
                    updateData.sku = payload.newSku;
                    updateData.approval_details.skuChanged = {
                        from: sku,
                        to: payload.newSku,
                        timestamp
                    };
                    console.log('🏷️ Cambiando SKU:', `${sku} → ${payload.newSku}`);
                }
                break;
                
            case 'PURCHASE_APPROVED':
                updateData.purchase_details = {
                    ...payload,
                    timestamp,
                    previousStatus: product.status,
                    nextStatus,
                    approvalData: product.approval_details || null
                };
                break;
                
            case 'PURCHASE_CONFIRMED':
                updateData.manufacturing_details = {
                    ...payload,
                    timestamp,
                    previousStatus: product.status,
                    nextStatus,
                    purchaseData: product.purchase_details || null
                };
                break;
                
            case 'MANUFACTURED':
                updateData.shipping_details = {
                    ...payload,
                    timestamp,
                    previousStatus: product.status,
                    nextStatus,
                    manufacturingData: product.manufacturing_details || null
                };
                break;
        }

        console.log('🔄 Actualizando en Supabase:', updateData);
        
        // Actualizar en Supabase
        const { data: updatedProduct, error: updateError } = await supabase
            .from('products')
            .update(updateData)
            .eq('sku', sku)
            .select()
            .single();
        
        if (updateError) {
            console.log('❌ Error actualizando en Supabase:', updateError.message);
            return res.status(500).json({ error: 'Error actualizando el producto: ' + updateError.message });
        }
        
        console.log('💾 Producto actualizado exitosamente en Supabase');
        const finalSku = updateData.sku || sku;
        const skuChangedMessage = updateData.sku ? ` (SKU cambiado de ${sku} a ${updateData.sku})` : '';
        return res.status(200).json({ 
            message: `Estado del SKU ${finalSku} actualizado a ${nextStatus}${skuChangedMessage}`,
            newSku: updateData.sku || null
        });
    } else {
        return res.status(400).json({ 
            error: 'Transición de estado no válida.',
            current: product.status,
            requested: nextStatus
        });
    }
}
