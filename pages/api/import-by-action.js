// pages/api/import-by-action.js
import { supabase } from '../../lib/supabaseClient';
import XLSX from 'xlsx';
import formidable from 'formidable';
import fs from 'fs';
import { createPurchaseOrder } from '../../lib/purchaseOrdersHelper';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1️⃣ Parsear archivo Excel
    const form = formidable({ multiples: false });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    const file = files.file?.[0] || files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Leer archivo Excel
    const fileBuffer = fs.readFileSync(file.filepath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = 'Datos';

    if (!workbook.Sheets[sheetName]) {
      return res.status(400).json({ error: 'Sheet "Datos" not found in Excel file' });
    }

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      return res.status(400).json({ error: 'No data found in Excel file' });
    }

    console.log(`📥 Importing ${data.length} rows`);

    // 2️⃣ Detectar tipo de acción basado en columnas
    const action = detectAction(data[0]);
    console.log(`🔍 Detected action: ${action}`);

    if (action === 'unknown') {
      return res.status(400).json({
        error: 'Unable to detect action type from Excel columns',
        foundColumns: Object.keys(data[0])
      });
    }

    // 3️⃣ Procesar cada fila
    const results = await processImport(data, action);

    // 4️⃣ Invalidar cache después de updates
    try {
      await supabase
        .from('dashboard_analysis_cache')
        .delete()
        .gt('sku', ''); // Eliminar todo el cache
      console.log('✅ Cache invalidated');
    } catch (error) {
      console.log('⚠️ Cache invalidation failed:', error.message);
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    return res.status(200).json({
      success: true,
      action: action,
      processed: data.length,
      successCount: successCount,
      errorCount: errorCount,
      details: results
    });

  } catch (error) {
    console.error('❌ Import error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Detectar acción por las columnas del Excel
function detectAction(firstRow) {
  const columns = Object.keys(firstRow);

  // Buscar columnas características de cada acción
  if (columns.includes('📝 Motivo') && columns.includes('✅ Forzar Cotización')) {
    return 'force_request_quote';
  }
  if (columns.includes('📝 Precio Unitario') && columns.includes('📝 Moneda')) {
    return 'quote';
  }
  if (columns.includes('📝 Precio de Venta a Usar')) {
    return 'analyze';
  }
  if (columns.includes('✅ Aprobar') && columns.includes('📝 Precio Objetivo (Negociar)')) {
    return 'approve';
  }
  if (columns.includes('📝 Proveedor') && columns.includes('📝 Número de Orden')) {
    return 'confirm_purchase';
  }
  if (columns.includes('📝 Notas de Calidad')) {
    return 'confirm_manufacturing';
  }
  if (columns.includes('📝 Número de Contenedor')) {
    return 'confirm_shipping';
  }
  if (columns.includes('✅ Recibido') && columns.includes('📝 Cantidad Recibida')) {
    return 'mark_received';
  }
  if (columns.includes('✅ Acción') && columns.includes('📝 Cantidad a Cotizar')) {
    return 'request_quote';
  }

  return 'unknown';
}

// Procesar importación
async function processImport(data, action) {
  const results = [];

  for (const row of data) {
    try {
      const sku = row.SKU;
      if (!sku) {
        results.push({ sku: 'N/A', success: false, reason: 'SKU missing' });
        continue;
      }

      // Verificar si el usuario marcó la acción
      const shouldProcess = checkShouldProcess(row, action);
      if (!shouldProcess) {
        results.push({ sku, success: false, reason: 'No marcado para procesar' });
        continue;
      }

      // Procesar según la acción
      switch(action) {
        case 'force_request_quote':
          await processForceRequestQuote(sku, row);
          break;
        case 'request_quote':
          await processRequestQuote(sku, row);
          break;
        case 'quote':
          await processQuote(sku, row);
          break;
        case 'analyze':
          await processAnalyze(sku, row);
          break;
        case 'approve':
          await processApprove(sku, row);
          break;
        case 'confirm_purchase':
          await processConfirmPurchase(sku, row);
          break;
        case 'confirm_manufacturing':
          await processConfirmManufacturing(sku, row);
          break;
        case 'confirm_shipping':
          await processConfirmShipping(sku, row);
          break;
        case 'mark_received':
          await processMarkReceived(sku, row);
          break;
        case 'cancel_reminder':
          await processCancelReminder(sku, row);
          break;
        case 'reactivate_disregarded':
          await processReactivateDisregarded(sku, row);
          break;
      }

      results.push({ sku, success: true, action });
      console.log(`✅ Processed ${sku}: ${action}`);

    } catch (error) {
      results.push({ sku: row.SKU, success: false, error: error.message });
      console.error(`❌ Error processing ${row.SKU}:`, error.message);
    }
  }

  return results;
}

// Verificar si debe procesarse
function checkShouldProcess(row, action) {
  const actionColumns = {
    force_request_quote: '✅ Forzar Cotización',
    request_quote: '✅ Acción',
    quote: '✅ Acción',
    analyze: '✅ Analizar',
    approve: '✅ Aprobar',
    confirm_purchase: '✅ Confirmado',
    cancel_reminder: '📝 Cancelar Recordatorio',
    reactivate_disregarded: '📝 Reactivar',
    confirm_manufacturing: '✅ Fabricado',
    confirm_shipping: '✅ Enviado',
    mark_received: '✅ Recibido'
  };

  const column = actionColumns[action];
  if (!column) return true;

  const value = row[column];
  return value && value.toString().toUpperCase() === 'SI';
}

// Procesar: Forzar cotización
async function processForceRequestQuote(sku, row) {
  const cantidadACotizar = parseInt(row['📝 Cantidad a Cotizar']);
  const motivo = row['📝 Motivo'];
  const comentarios = row['📝 Comentarios'] || '';

  if (!cantidadACotizar || cantidadACotizar <= 0) {
    throw new Error('Cantidad a cotizar debe ser mayor a 0');
  }

  if (!motivo) {
    throw new Error('Motivo es requerido');
  }

  await supabase
    .from('products')
    .update({
      status: 'QUOTE_REQUESTED',
      request_details: {
        quantityToQuote: cantidadACotizar,
        comments: comentarios,
        motivo: motivo,
        forced: true,
        previousStatus: 'NO_REPLENISHMENT_NEEDED',
        timestamp: new Date().toISOString()
      },
    })
    .eq('sku', sku);
}

// Procesar: Solicitar cotización
async function processRequestQuote(sku, row) {
  const cantidadACotizar = parseInt(row['📝 Cantidad a Cotizar']);
  const comentarios = row['📝 Comentarios'] || '';
  const recordarFecha = row['📝 Recuérdame (Fecha)'];
  const desconsiderar = row['📝 Desconsiderar'];

  // Debug logging para SKU específico
  if (sku === '120') {
    console.log('🔍 DEBUG SKU 120:', {
      recordarFecha,
      tipoRecordarFecha: typeof recordarFecha,
      desconsiderar,
      cantidadACotizar
    });
  }

  // Si el usuario quiere desconsiderar (marcar en campo desconsiderado)
  if (desconsiderar && (desconsiderar.toString().toUpperCase() === 'SI' || desconsiderar.toString().toUpperCase() === 'SÍ')) {
    await supabase
      .from('products')
      .update({
        desconsiderado: true
      })
      .eq('sku', sku);

    return; // No continuar con el resto del proceso
  }

  // Si el usuario quiere un recordatorio
  if (recordarFecha !== undefined && recordarFecha !== null && recordarFecha !== '') {
    let isoDate = null;

    // Manejar si es un objeto Date de Excel
    if (recordarFecha instanceof Date && !isNaN(recordarFecha.getTime())) {
      const year = recordarFecha.getFullYear();
      const month = String(recordarFecha.getMonth() + 1).padStart(2, '0');
      const day = String(recordarFecha.getDate()).padStart(2, '0');
      isoDate = `${year}-${month}-${day}`;
    }
    // Manejar si es un número (fecha serial de Excel)
    else if (typeof recordarFecha === 'number' && !isNaN(recordarFecha)) {
      // Convertir número serial de Excel a fecha
      const excelDate = new Date((recordarFecha - 25569) * 86400 * 1000);
      if (!isNaN(excelDate.getTime())) {
        const year = excelDate.getFullYear();
        const month = String(excelDate.getMonth() + 1).padStart(2, '0');
        const day = String(excelDate.getDate()).padStart(2, '0');
        isoDate = `${year}-${month}-${day}`;
      }
    }
    // Manejar si es un string DD-MM-YYYY
    else if (typeof recordarFecha === 'string' && recordarFecha.trim() !== '') {
      const parts = recordarFecha.trim().split(/[-/]/);
      if (parts.length === 3) {
        const [day, month, year] = parts;
        isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      } else {
        throw new Error('Fecha de recordatorio inválida. Formato: DD-MM-YYYY');
      }
    }

    // Si se pudo parsear la fecha, guardar el recordatorio en la tabla replenishment_reminders
    if (isoDate) {
      const reminderDate = new Date(isoDate);
      if (isNaN(reminderDate.getTime())) {
        throw new Error('Fecha de recordatorio inválida');
      }

      // Obtener info del producto
      const { data: product } = await supabase
        .from('products')
        .select('descripcion, status')
        .eq('sku', sku)
        .single();

      // Crear recordatorio en tabla replenishment_reminders
      await supabase
        .from('replenishment_reminders')
        .insert({
          sku: sku,
          product_description: product?.descripcion || '',
          current_status: product?.status || 'NEEDS_REPLENISHMENT',
          reminder_date: isoDate,
          notes: comentarios || '',
          is_active: true,
          created_at: new Date().toISOString()
        });

      return; // No continuar con el resto del proceso
    }
  }

  // Proceso normal: solicitar cotización
  if (!cantidadACotizar || cantidadACotizar <= 0) {
    throw new Error('Cantidad a cotizar debe ser mayor a 0');
  }

  // NUEVO: Crear orden en purchase_orders en lugar de actualizar products.status
  await createPurchaseOrder(sku, cantidadACotizar, comentarios);

  // Actualizar primary_status del producto
  await supabase
    .from('products')
    .update({ primary_status: 'QUOTE_REQUESTED' })
    .eq('sku', sku);
}

// Procesar: Cotizar
async function processQuote(sku, row) {
  const unitPrice = parseFloat(row['📝 Precio Unitario']);
  const currency = row['📝 Moneda'] || 'RMB';
  const unitsPerBox = parseInt(row['📝 Unidades por Bulto']);
  const cbmPerBox = parseFloat(row['📝 CBM por Bulto']);
  const productionDays = parseInt(row['📝 Días de Producción']);
  const comments = row['📝 Comentarios Cotización'] || '';

  if (!unitPrice || unitPrice <= 0) {
    throw new Error('Precio unitario es requerido');
  }

  await supabase
    .from('products')
    .update({
      status: 'QUOTED',
      quote_details: {
        unitPrice: unitPrice,
        currency: currency,
        unitsPerBox: unitsPerBox || null,
        cbmPerBox: cbmPerBox || null,
        productionDays: productionDays || 30,
        comments: comments,
        timestamp: new Date().toISOString()
      },
    })
    .eq('sku', sku);
}

// Procesar: Analizar
async function processAnalyze(sku, row) {
  const sellingPrice = parseFloat(row['📝 Precio de Venta a Usar']);
  const comments = row['📝 Comentarios Análisis'] || '';

  if (!sellingPrice || sellingPrice <= 0) {
    throw new Error('Precio de venta es requerido');
  }

  // Obtener datos del producto para calcular ganancia y margen
  const { data: product } = await supabase
    .from('products')
    .select('quote_details')
    .eq('sku', sku)
    .single();

  const quoteDetails = product?.quote_details || {};
  const unitPrice = parseFloat(quoteDetails.unitPrice) || 0;

  // Calcular ganancia y margen
  const profitPerUnit = sellingPrice - unitPrice;
  const marginPercent = sellingPrice > 0 ? ((profitPerUnit / sellingPrice) * 100) : 0;

  const { error } = await supabase
    .from('products')
    .update({
      status: 'ANALYZING',
      analysis_details: {
        sellingPrice: sellingPrice,
        estimatedProfit: profitPerUnit,
        marginPercent: marginPercent,
        comments: comments,
        timestamp: new Date().toISOString()
      },
      precio_venta_sugerido: sellingPrice,
    })
    .eq('sku', sku);

  if (error) {
    throw new Error(`Error updating SKU ${sku}: ${error.message}`);
  }
}

// Procesar: Aprobar
async function processApprove(sku, row) {
  const approvedQuantity = parseInt(row['📝 Cantidad Final a Comprar']);
  const targetPrice = parseFloat(row['📝 Precio Objetivo (Negociar)']);
  const desiredDate = row['📝 Fecha Entrega Deseada'];
  const comments = row['📝 Comentarios Aprobación'] || '';

  if (!approvedQuantity || approvedQuantity <= 0) {
    throw new Error('Cantidad Final a Comprar es requerida y debe ser mayor a 0');
  }

  await supabase
    .from('products')
    .update({
      status: 'PURCHASE_APPROVED',
      approval_details: {
        approved: true,
        approvedQuantity: approvedQuantity,
        targetPurchasePrice: targetPrice || null,
        estimatedDeliveryDate: desiredDate || null,
        comments: comments,
        timestamp: new Date().toISOString()
      },
    })
    .eq('sku', sku);
}

// Procesar: Confirmar compra
async function processConfirmPurchase(sku, row) {
  const quantity = parseInt(row['📝 Cantidad Comprada']);
  const finalPrice = parseFloat(row['📝 Precio Final']);
  const supplier = row['📝 Proveedor'];
  const orderNumber = row['📝 Número de Orden'];
  const purchaseDate = row['📝 Fecha de Compra'];
  const estimatedArrival = row['📝 Fecha Entrega Estimada'];
  const comments = row['📝 Comentarios'] || '';

  if (!quantity || quantity <= 0) {
    throw new Error('Cantidad comprada es requerida');
  }

  if (!supplier) {
    throw new Error('Proveedor es requerido');
  }

  // Crear registro en tabla compras
  await supabase
    .from('compras')
    .insert({
      sku: sku,
      cantidad: quantity,
      fecha_compra: purchaseDate || new Date().toISOString().split('T')[0],
      fecha_llegada_estimada: estimatedArrival,
      status_compra: 'en_transito',
      costo_unitario: finalPrice || null,
      proveedor: supplier,
      numero_orden: orderNumber || null,
      notas: comments
    });

  // Actualizar producto
  await supabase
    .from('products')
    .update({
      status: 'PURCHASE_CONFIRMED',
      purchase_details: {
        quantity: quantity,
        finalPrice: finalPrice,
        supplier: supplier,
        orderNumber: orderNumber,
        purchaseDate: purchaseDate,
        estimatedArrival: estimatedArrival,
        comments: comments,
        timestamp: new Date().toISOString()
      },
    })
    .eq('sku', sku);
}

// Procesar: Confirmar fabricación
async function processConfirmManufacturing(sku, row) {
  const completionDate = row['📝 Fecha Fabricación Completa'];
  const qualityNotes = row['📝 Notas de Calidad'] || '';
  const comments = row['📝 Comentarios'] || '';

  if (!completionDate) {
    throw new Error('Fecha de fabricación completa es requerida');
  }

  await supabase
    .from('products')
    .update({
      status: 'MANUFACTURED',
      manufacturing_details: {
        completionDate: completionDate,
        qualityNotes: qualityNotes,
        comments: comments,
        timestamp: new Date().toISOString()
      },
    })
    .eq('sku', sku);
}

// Procesar: Confirmar envío
async function processConfirmShipping(sku, row) {
  const containerNumber = row['📝 Número de Contenedor'];
  const shippingDate = row['📝 Fecha de Embarque'];
  const eta = row['📝 ETA (Llegada Estimada)'];
  const comments = row['📝 Comentarios'] || '';

  if (!containerNumber) {
    throw new Error('Número de contenedor es requerido');
  }

  if (!eta) {
    throw new Error('ETA (fecha llegada estimada) es requerida');
  }

  // Actualizar compra con datos de envío
  await supabase
    .from('compras')
    .update({
      fecha_llegada_estimada: eta
    })
    .eq('sku', sku)
    .eq('status_compra', 'en_transito');

  // Actualizar producto
  await supabase
    .from('products')
    .update({
      status: 'SHIPPED',
      shipping_details: {
        containerNumber: containerNumber,
        shippingDate: shippingDate,
        eta: eta,
        comments: comments,
        timestamp: new Date().toISOString()
      },
    })
    .eq('sku', sku);
}

// Procesar: Marcar como recibido
async function processMarkReceived(sku, row) {
  const receivedDate = row['📝 Fecha Recepción Real'];
  const quantityReceived = parseInt(row['📝 Cantidad Recibida']);
  const productCondition = row['📝 Estado del Producto'];
  const observations = row['📝 Observaciones'] || '';

  if (!receivedDate) {
    throw new Error('Fecha de recepción es requerida');
  }

  if (!quantityReceived || quantityReceived <= 0) {
    throw new Error('Cantidad recibida es requerida');
  }

  // Actualizar stock actual
  const { data: currentProduct } = await supabase
    .from('products')
    .select('stock_actual')
    .eq('sku', sku)
    .single();

  const currentStock = currentProduct?.stock_actual || 0;
  const newStock = currentStock + quantityReceived;

  // Actualizar compra como recibida
  await supabase
    .from('compras')
    .update({
      status_compra: 'recibido',
      fecha_llegada_real: receivedDate
    })
    .eq('sku', sku)
    .eq('status_compra', 'en_transito');

  // Actualizar producto
  await supabase
    .from('products')
    .update({
      status: 'NO_REPLENISHMENT_NEEDED',
      stock_actual: newStock,
    })
    .eq('sku', sku);

  console.log(`✅ Stock updated for ${sku}: ${currentStock} + ${quantityReceived} = ${newStock}`);
}

// Cancelar recordatorio
async function processCancelReminder(sku, row) {
  // Desactivar recordatorio en la tabla replenishment_reminders
  const { error } = await supabase
    .from('replenishment_reminders')
    .update({ is_active: false })
    .eq('sku', sku)
    .eq('is_active', true);

  if (error) {
    throw new Error(`Error cancelando recordatorio: ${error.message}`);
  }

  console.log(`✅ Recordatorio cancelado para SKU ${sku}`);
}

// Reactivar desconsiderado
async function processReactivateDisregarded(sku, row) {
  // Reactivar producto desconsiderado
  const { error } = await supabase
    .from('products')
    .update({ desconsiderado: false })
    .eq('sku', sku);

  if (error) {
    throw new Error(`Error reactivando SKU: ${error.message}`);
  }

  console.log(`✅ SKU reactivado: ${sku}`);
}
