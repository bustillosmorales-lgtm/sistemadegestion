// pages/api/purchase-orders.js
// API para gestionar múltiples órdenes de compra por SKU

import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        return await handleGet(req, res);
      case 'POST':
        return await handlePost(req, res);
      case 'PUT':
        return await handlePut(req, res);
      case 'DELETE':
        return await handleDelete(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in purchase-orders API:', error);
    return res.status(500).json({ error: error.message });
  }
}

// GET: Obtener órdenes
async function handleGet(req, res) {
  const { sku, order_number, status, active_only } = req.query;

  let query = supabase.from('purchase_orders').select('*');

  if (sku) {
    query = query.eq('sku', sku);
  }

  if (order_number) {
    query = query.eq('order_number', order_number);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (active_only === 'true') {
    query = query.not('status', 'in', '(RECEIVED,CANCELLED)');
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error fetching orders: ${error.message}`);
  }

  // Si se pidió por SKU, agregar resumen
  if (sku && data) {
    const summary = calculateOrdersSummary(data);
    return res.status(200).json({
      orders: data,
      summary: summary
    });
  }

  return res.status(200).json({ orders: data });
}

// POST: Crear nueva orden
async function handlePost(req, res) {
  const { sku, cantidad_solicitada, notes, request_details } = req.body;

  if (!sku || !cantidad_solicitada) {
    return res.status(400).json({ error: 'SKU y cantidad_solicitada son requeridos' });
  }

  // Verificar que el producto existe
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('sku, descripcion')
    .eq('sku', sku)
    .single();

  if (productError || !product) {
    return res.status(404).json({ error: `Producto ${sku} no encontrado` });
  }

  // Generar número de orden único
  const orderNumber = await generateUniqueOrderNumber();

  // Crear orden
  const newOrder = {
    sku: sku,
    order_number: orderNumber,
    cantidad_solicitada: parseInt(cantidad_solicitada),
    cantidad_recibida: 0,
    status: 'QUOTE_REQUESTED',
    request_details: request_details || {
      quantityToQuote: parseInt(cantidad_solicitada),
      comments: notes || '',
      timestamp: new Date().toISOString()
    },
    notes: notes || '',
    created_at: new Date().toISOString()
  };

  const { data: orderData, error: orderError } = await supabase
    .from('purchase_orders')
    .insert(newOrder)
    .select();

  if (orderError) {
    throw new Error(`Error creating order: ${orderError.message}`);
  }

  console.log(`✅ Nueva orden creada: ${orderNumber} para SKU ${sku}`);

  return res.status(201).json({
    success: true,
    order: orderData[0],
    message: `Orden ${orderNumber} creada exitosamente`
  });
}

// PUT: Actualizar orden existente
async function handlePut(req, res) {
  const { order_number, status, cantidad_recibida, details, notes } = req.body;

  if (!order_number) {
    return res.status(400).json({ error: 'order_number es requerido' });
  }

  const updates = {};

  if (status) {
    updates.status = status;

    // Si se marca como RECEIVED, establecer completed_at
    if (status === 'RECEIVED') {
      updates.completed_at = new Date().toISOString();
    }

    // Si se marca como CANCELLED, establecer cancelled_at
    if (status === 'CANCELLED') {
      updates.cancelled_at = new Date().toISOString();
    }
  }

  if (cantidad_recibida !== undefined) {
    updates.cantidad_recibida = parseInt(cantidad_recibida);
  }

  if (notes) {
    updates.notes = notes;
  }

  // Actualizar detalles según el status
  if (details) {
    switch (status) {
      case 'QUOTED':
        updates.quote_details = details;
        break;
      case 'ANALYZING':
        updates.analysis_details = details;
        break;
      case 'PURCHASE_APPROVED':
        updates.approval_details = details;
        break;
      case 'MANUFACTURING':
        updates.manufacturing_details = details;
        break;
      case 'SHIPPING':
        updates.shipping_details = details;
        break;
    }
  }

  const { data, error } = await supabase
    .from('purchase_orders')
    .update(updates)
    .eq('order_number', order_number)
    .select();

  if (error) {
    throw new Error(`Error updating order: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return res.status(404).json({ error: `Orden ${order_number} no encontrada` });
  }

  console.log(`✅ Orden actualizada: ${order_number} -> ${status || 'updated'}`);

  return res.status(200).json({
    success: true,
    order: data[0],
    message: `Orden ${order_number} actualizada exitosamente`
  });
}

// DELETE: Cancelar orden
async function handleDelete(req, res) {
  const { order_number, reason } = req.body;

  if (!order_number) {
    return res.status(400).json({ error: 'order_number es requerido' });
  }

  const { data, error } = await supabase
    .from('purchase_orders')
    .update({
      status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
      cancelled_reason: reason || 'Cancelado por usuario',
      notes: `CANCELADO: ${reason || 'Sin razón especificada'}`
    })
    .eq('order_number', order_number)
    .select();

  if (error) {
    throw new Error(`Error cancelling order: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return res.status(404).json({ error: `Orden ${order_number} no encontrada` });
  }

  console.log(`❌ Orden cancelada: ${order_number}`);

  return res.status(200).json({
    success: true,
    order: data[0],
    message: `Orden ${order_number} cancelada exitosamente`
  });
}

// Función auxiliar: Generar número de orden único
async function generateUniqueOrderNumber() {
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const random = Math.floor(Math.random() * 10000).toString().padStart(5, '0');
  const orderNumber = `ORD-${timestamp.slice(0, 8)}-${random}`;

  // Verificar si ya existe
  const { data } = await supabase
    .from('purchase_orders')
    .select('order_number')
    .eq('order_number', orderNumber)
    .single();

  // Si existe, generar otro
  if (data) {
    return generateUniqueOrderNumber();
  }

  return orderNumber;
}

// Función auxiliar: Calcular resumen de órdenes
function calculateOrdersSummary(orders) {
  const activeOrders = orders.filter(o => !['RECEIVED', 'CANCELLED'].includes(o.status));
  const completedOrders = orders.filter(o => o.status === 'RECEIVED');
  const cancelledOrders = orders.filter(o => o.status === 'CANCELLED');

  const totalSolicitado = orders.reduce((sum, o) => sum + (o.cantidad_solicitada || 0), 0);
  const totalRecibido = orders.reduce((sum, o) => sum + (o.cantidad_recibida || 0), 0);
  const cantidadEnProceso = activeOrders.reduce((sum, o) =>
    sum + (o.cantidad_solicitada - o.cantidad_recibida), 0);

  const statusCounts = {};
  orders.forEach(order => {
    statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
  });

  return {
    totalOrdenes: orders.length,
    ordenesActivas: activeOrders.length,
    ordenesCompletadas: completedOrders.length,
    ordenesCanceladas: cancelledOrders.length,
    totalSolicitado: totalSolicitado,
    totalRecibido: totalRecibido,
    cantidadEnProceso: cantidadEnProceso,
    statusCounts: statusCounts,
    ultimaOrden: orders.length > 0 ? orders[0].created_at : null
  };
}
