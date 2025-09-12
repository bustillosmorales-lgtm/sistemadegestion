// pages/api/queue-cache.js - API para manejar cola de actualización de cache
import { addToQueue, addManyToQueue, getQueueStatus, clearQueue, startQueueProcessing, stopQueueProcessing } from '../../lib/queueManager.js';

export const config = {
  api: {
    responseLimit: false,
  },
  maxDuration: 10, // Endpoint rápido
}

export default async function handler(req, res) {
  try {
    const { method } = req;
    const { action, sku, skus, reason } = req.body || {};

    switch (method) {
      case 'POST':
        return handlePost(req, res, action, sku, skus, reason);
      case 'GET':
        return handleGet(req, res);
      default:
        return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('❌ Error en queue-cache API:', error);
    return res.status(500).json({ 
      error: error.message,
      success: false 
    });
  }
}

async function handlePost(req, res, action, sku, skus, reason) {
  switch (action) {
    case 'add':
      if (!sku) {
        return res.status(400).json({ error: 'SKU requerido para agregar' });
      }
      addToQueue(sku, reason || 'manual');
      return res.json({
        success: true,
        message: `SKU ${sku} agregado a cola`,
        status: getQueueStatus()
      });

    case 'add-many':
      if (!Array.isArray(skus) || skus.length === 0) {
        return res.status(400).json({ error: 'Array de SKUs requerido' });
      }
      addManyToQueue(skus, reason || 'bulk_manual');
      return res.json({
        success: true,
        message: `${skus.length} SKUs agregados a cola`,
        status: getQueueStatus()
      });

    case 'start':
      startQueueProcessing();
      return res.json({
        success: true,
        message: 'Procesamiento de cola iniciado',
        status: getQueueStatus()
      });

    case 'stop':
      stopQueueProcessing();
      return res.json({
        success: true,
        message: 'Procesamiento de cola detenido',
        status: getQueueStatus()
      });

    case 'clear':
      clearQueue();
      return res.json({
        success: true,
        message: 'Cola limpiada',
        status: getQueueStatus()
      });

    default:
      return res.status(400).json({ 
        error: 'Acción no válida',
        validActions: ['add', 'add-many', 'start', 'stop', 'clear']
      });
  }
}

async function handleGet(req, res) {
  const status = getQueueStatus();
  
  return res.json({
    success: true,
    message: 'Estado de cola obtenido',
    status: status,
    info: {
      description: 'Sistema de cola para actualización automática de cache',
      batchSize: 50,
      intervalMinutes: 5,
      usage: {
        'POST /api/queue-cache': {
          'add': 'Agregar un SKU: { action: "add", sku: "SKU123", reason: "stock_change" }',
          'add-many': 'Agregar múltiples: { action: "add-many", skus: ["SKU1", "SKU2"], reason: "bulk_update" }',
          'start': 'Iniciar procesamiento: { action: "start" }',
          'stop': 'Detener procesamiento: { action: "stop" }',
          'clear': 'Limpiar cola: { action: "clear" }'
        },
        'GET /api/queue-cache': 'Obtener estado actual de la cola'
      }
    }
  });
}