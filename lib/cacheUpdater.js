// lib/cacheUpdater.js - Funciones para activar actualizaciones de cache automáticamente
import { addToQueue, addManyToQueue } from './queueManager.js';

// Activar cuando cambie stock de un producto
export function onStockChange(sku, oldStock, newStock, reason = 'stock_change') {
  console.log(`📦 Stock cambió para ${sku}: ${oldStock} → ${newStock}`);
  addToQueue(sku, reason);
}

// Activar cuando cambie precio de un producto
export function onPriceChange(sku, oldPrice, newPrice, reason = 'price_change') {
  console.log(`💰 Precio cambió para ${sku}: ${oldPrice} → ${newPrice}`);
  addToQueue(sku, reason);
}

// Activar cuando se actualice status de un producto
export function onStatusChange(sku, oldStatus, newStatus, reason = 'status_change') {
  console.log(`📊 Status cambió para ${sku}: ${oldStatus} → ${newStatus}`);
  addToQueue(sku, reason);
}

// Activar cuando haya nueva venta
export function onNewSale(sku, cantidad, reason = 'new_sale') {
  console.log(`🛒 Nueva venta para ${sku}: ${cantidad} unidades`);
  addToQueue(sku, reason);
}

// Activar cuando llegue nueva compra/stock
export function onNewPurchase(sku, cantidad, reason = 'new_purchase') {
  console.log(`📦 Nueva compra para ${sku}: ${cantidad} unidades`);
  addToQueue(sku, reason);
}

// Activar cuando se modifique configuración global
export function onConfigChange(reason = 'config_change') {
  console.log(`⚙️ Configuración global cambió - requiere recalcular todos los SKUs`);
  // Para cambios de configuración, agregar solo SKUs activos para evitar sobrecarga
  triggerActiveSkusUpdate(reason);
}

// Actualizar solo SKUs que necesitan reposición (más eficiente)
async function triggerActiveSkusUpdate(reason) {
  try {
    // Obtener solo SKUs con cantidad sugerida > 0 (productos activos)
    const { supabase } = await import('./supabaseClient.js');
    
    const { data: activeSKUs, error } = await supabase
      .from('sku_analysis_cache')
      .select('sku')
      .or('cantidad_sugerida_30d.gt.0,cantidad_sugerida_60d.gt.0,cantidad_sugerida_90d.gt.0')
      .limit(500); // Limitar para evitar sobrecarga
    
    if (error) {
      console.error('Error obteniendo SKUs activos:', error.message);
      return;
    }
    
    const skuList = activeSKUs?.map(item => item.sku) || [];
    if (skuList.length > 0) {
      addManyToQueue(skuList, reason);
    }
    
  } catch (error) {
    console.error('Error en triggerActiveSkusUpdate:', error.message);
  }
}

// Hook para integrar con APIs existentes
export function integrateWithAPI(req, res, next) {
  // Middleware para detectar cambios automáticamente
  const originalJson = res.json;
  
  res.json = function(data) {
    // Detectar si la respuesta indica cambios relevantes
    if (data && data.success && req.body) {
      const { sku } = req.body;
      
      // Determinar qué tipo de cambio ocurrió basado en la URL
      if (req.url.includes('/products') && sku) {
        if (req.body.stock_actual !== undefined) {
          onStockChange(sku, null, req.body.stock_actual, 'api_stock_update');
        }
        if (req.body.precio_venta_sugerido !== undefined) {
          onPriceChange(sku, null, req.body.precio_venta_sugerido, 'api_price_update');
        }
        if (req.body.status !== undefined) {
          onStatusChange(sku, null, req.body.status, 'api_status_update');
        }
      }
      
      if (req.url.includes('/ventas') && sku) {
        onNewSale(sku, req.body.cantidad, 'api_new_sale');
      }
      
      if (req.url.includes('/compras') && sku) {
        onNewPurchase(sku, req.body.cantidad, 'api_new_purchase');
      }
    }
    
    return originalJson.call(this, data);
  };
  
  next();
}

// Funciones para usar en componentes React
export const CacheUpdater = {
  onStockChange,
  onPriceChange,  
  onStatusChange,
  onNewSale,
  onNewPurchase,
  onConfigChange,
  
  // Función para llamar desde frontend
  async updateSKU(sku, reason = 'manual_frontend') {
    try {
      const response = await fetch('/api/queue-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'add', 
          sku, 
          reason 
        })
      });
      
      return await response.json();
    } catch (error) {
      console.error('Error actualizando SKU desde frontend:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Función para obtener estado desde frontend
  async getStatus() {
    try {
      const response = await fetch('/api/queue-cache');
      return await response.json();
    } catch (error) {
      console.error('Error obteniendo estado de cola:', error);
      return { success: false, error: error.message };
    }
  }
};