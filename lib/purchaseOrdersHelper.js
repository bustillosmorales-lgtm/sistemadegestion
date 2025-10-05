// lib/purchaseOrdersHelper.js
// Funciones helper para gestionar múltiples órdenes de compra

import { supabase } from './supabaseClient';

/**
 * Obtiene el resumen de órdenes activas para un SKU
 * @param {string} sku - El SKU del producto
 * @returns {Object} Resumen de órdenes
 */
export async function getActiveOrdersSummary(sku) {
  try {
    const { data: orders, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('sku', sku)
      .not('status', 'in', '(RECEIVED,CANCELLED)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error fetching orders for ${sku}:`, error);
      return {
        hasOrders: false,
        totalOrders: 0,
        cantidadEnProceso: 0,
        orders: []
      };
    }

    const cantidadEnProceso = (orders || []).reduce((sum, order) => {
      return sum + (order.cantidad_solicitada - order.cantidad_recibida);
    }, 0);

    return {
      hasOrders: orders && orders.length > 0,
      totalOrders: orders?.length || 0,
      cantidadEnProceso: cantidadEnProceso,
      orders: orders || [],
      primaryStatus: orders && orders.length > 0 ? orders[0].status : null
    };
  } catch (error) {
    console.error(`Error in getActiveOrdersSummary for ${sku}:`, error);
    return {
      hasOrders: false,
      totalOrders: 0,
      cantidadEnProceso: 0,
      orders: []
    };
  }
}

/**
 * Obtiene el resumen de órdenes para múltiples SKUs en batch
 * @param {Array} skuList - Lista de SKUs
 * @returns {Map} Mapa de SKU -> resumen de órdenes
 */
export async function getActiveOrdersSummaryBatch(skuList) {
  if (!skuList || skuList.length === 0) {
    return new Map();
  }

  try {
    const { data: orders, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .in('sku', skuList)
      .not('status', 'in', '(RECEIVED,CANCELLED)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders batch:', error);
      return new Map();
    }

    // Agrupar por SKU
    const ordersMap = new Map();

    (orders || []).forEach(order => {
      if (!ordersMap.has(order.sku)) {
        ordersMap.set(order.sku, []);
      }
      ordersMap.get(order.sku).push(order);
    });

    // Calcular resumen para cada SKU
    const summaryMap = new Map();

    skuList.forEach(sku => {
      const skuOrders = ordersMap.get(sku) || [];
      const cantidadEnProceso = skuOrders.reduce((sum, order) => {
        return sum + (order.cantidad_solicitada - order.cantidad_recibida);
      }, 0);

      summaryMap.set(sku, {
        hasOrders: skuOrders.length > 0,
        totalOrders: skuOrders.length,
        cantidadEnProceso: cantidadEnProceso,
        orders: skuOrders,
        primaryStatus: skuOrders.length > 0 ? skuOrders[0].status : null
      });
    });

    return summaryMap;
  } catch (error) {
    console.error('Error in getActiveOrdersSummaryBatch:', error);
    return new Map();
  }
}

/**
 * Calcula cantidad pendiente vs cantidad en proceso
 * @param {number} cantidadTotalNecesaria - Cantidad total que se necesita
 * @param {number} cantidadEnProceso - Cantidad ya en órdenes activas
 * @returns {Object} Análisis de la situación
 */
export function calculateReplenishmentStatus(cantidadTotalNecesaria, cantidadEnProceso) {
  const cantidadPendiente = Math.max(0, cantidadTotalNecesaria - cantidadEnProceso);

  let status = 'OK';
  let alert = null;
  let needsAction = false;

  if (cantidadPendiente > 0 && cantidadEnProceso > 0) {
    // Orden parcial - se necesita más
    status = 'PARTIAL';
    alert = {
      type: 'warning',
      message: `Orden parcial - Necesita ${cantidadPendiente} unidades adicionales`,
      icon: '⚠️'
    };
    needsAction = true;
  } else if (cantidadPendiente > 0 && cantidadEnProceso === 0) {
    // Crítico - no hay órdenes
    status = 'CRITICAL';
    alert = {
      type: 'critical',
      message: `Sin órdenes - Necesita ${cantidadPendiente} unidades`,
      icon: '❗'
    };
    needsAction = true;
  } else if (cantidadEnProceso > cantidadTotalNecesaria) {
    // Sobre-ordenado (verificar ANTES de COVERED)
    status = 'OVER_ORDERED';
    alert = {
      type: 'info',
      message: `Sobre-ordenado - ${cantidadEnProceso - cantidadTotalNecesaria} unidades en exceso`,
      icon: 'ℹ️'
    };
    needsAction = false;
  } else if (cantidadPendiente === 0 && cantidadEnProceso > 0) {
    // OK - cubierto por órdenes
    status = 'COVERED';
    alert = {
      type: 'success',
      message: `En proceso - ${cantidadEnProceso} unidades`,
      icon: '✅'
    };
    needsAction = false;
  }

  return {
    cantidadTotalNecesaria: cantidadTotalNecesaria,
    cantidadEnProceso: cantidadEnProceso,
    cantidadPendiente: cantidadPendiente,
    status: status,
    alert: alert,
    needsAction: needsAction,
    percentageCovered: cantidadTotalNecesaria > 0
      ? Math.round((cantidadEnProceso / cantidadTotalNecesaria) * 100)
      : 0
  };
}

/**
 * Determina si un SKU debe aparecer en NEEDS_REPLENISHMENT
 * @param {Object} replenishmentStatus - Estado de reposición del SKU
 * @returns {boolean}
 */
export function shouldShowInNeedsReplenishment(replenishmentStatus) {
  // Mostrar si hay cantidad pendiente > 0
  return replenishmentStatus.cantidadPendiente > 0;
}

/**
 * Genera un número de orden único
 * @returns {Promise<string>} Número de orden
 */
export async function generateOrderNumber() {
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const random = Math.floor(Math.random() * 10000).toString().padStart(5, '0');
  const orderNumber = `ORD-${timestamp.slice(0, 8)}-${random}`;

  // Verificar si ya existe
  const { data } = await supabase
    .from('purchase_orders')
    .select('order_number')
    .eq('order_number', orderNumber)
    .maybeSingle();

  // Si existe, generar otro
  if (data) {
    return generateOrderNumber();
  }

  return orderNumber;
}

/**
 * Crea una nueva orden de compra
 * @param {string} sku - SKU del producto
 * @param {number} cantidad - Cantidad a solicitar
 * @param {string} notes - Notas opcionales
 * @returns {Promise<Object>} Orden creada
 */
export async function createPurchaseOrder(sku, cantidad, notes = '') {
  const orderNumber = await generateOrderNumber();

  const newOrder = {
    sku: sku,
    order_number: orderNumber,
    cantidad_solicitada: parseInt(cantidad),
    cantidad_recibida: 0,
    status: 'QUOTE_REQUESTED',
    request_details: {
      quantityToQuote: parseInt(cantidad),
      comments: notes,
      timestamp: new Date().toISOString()
    },
    notes: notes,
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('purchase_orders')
    .insert(newOrder)
    .select();

  if (error) {
    throw new Error(`Error creating order: ${error.message}`);
  }

  console.log(`✅ Nueva orden creada: ${orderNumber} para SKU ${sku} (${cantidad} unidades)`);

  return data[0];
}
