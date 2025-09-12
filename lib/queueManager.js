// lib/queueManager.js - Sistema de cola para actualización de cache en background
import { supabase } from './supabaseClient.js';

class QueueManager {
  constructor() {
    this.queue = new Set(); // Usar Set para evitar duplicados automáticamente
    this.processing = false;
    this.processingInterval = null;
    this.BATCH_SIZE = 50; // Procesar 50 SKUs por batch
    this.INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
  }

  // Agregar SKU a la cola de actualización
  addToQueue(sku, reason = 'update') {
    if (!sku) return;
    
    this.queue.add(sku);
    console.log(`📝 SKU ${sku} agregado a cola (${reason}). Cola: ${this.queue.size} items`);
    
    // Si la cola era vacía, iniciar procesamiento
    if (this.queue.size === 1 && !this.processing) {
      this.startProcessing();
    }
  }

  // Agregar múltiples SKUs
  addManyToQueue(skus, reason = 'bulk_update') {
    if (!Array.isArray(skus)) return;
    
    skus.forEach(sku => this.queue.add(sku));
    console.log(`📝 ${skus.length} SKUs agregados a cola (${reason}). Cola total: ${this.queue.size} items`);
    
    if (!this.processing) {
      this.startProcessing();
    }
  }

  // Iniciar procesamiento en background
  startProcessing() {
    if (this.processing) return;
    
    this.processing = true;
    console.log('🚀 Iniciando procesamiento de cola en background...');
    
    // Procesar inmediatamente
    this.processBatch();
    
    // Programar procesamiento periódico
    this.processingInterval = setInterval(() => {
      this.processBatch();
    }, this.INTERVAL_MS);
  }

  // Detener procesamiento
  stopProcessing() {
    this.processing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    console.log('⏹️ Procesamiento de cola detenido');
  }

  // Procesar un lote de SKUs
  async processBatch() {
    if (this.queue.size === 0) {
      console.log('✅ Cola vacía, deteniendo procesamiento');
      this.stopProcessing();
      return;
    }

    // Tomar batch de SKUs
    const skusArray = Array.from(this.queue);
    const batch = skusArray.slice(0, this.BATCH_SIZE);
    
    console.log(`🔄 Procesando lote de ${batch.length} SKUs...`);
    
    try {
      // Importar función de actualización
      const { actualizarCacheAnalisisCompleto } = await import('../scripts/update-precio-cache.js');
      
      // Procesar lote
      await actualizarCacheAnalisisCompleto(batch);
      
      // Remover SKUs procesados de la cola
      batch.forEach(sku => this.queue.delete(sku));
      
      console.log(`✅ Lote procesado. SKUs restantes en cola: ${this.queue.size}`);
      
    } catch (error) {
      console.error('❌ Error procesando lote de cache:', error.message);
      
      // En caso de error, mantener SKUs en cola para reintento
      console.log(`⚠️ SKUs mantenidos en cola para reintento: ${batch.length}`);
    }
  }

  // Obtener estado de la cola
  getStatus() {
    return {
      queueSize: this.queue.size,
      processing: this.processing,
      nextBatchSize: Math.min(this.queue.size, this.BATCH_SIZE),
      queueItems: Array.from(this.queue).slice(0, 10) // Primeros 10 para debug
    };
  }

  // Limpiar cola completa
  clearQueue() {
    const size = this.queue.size;
    this.queue.clear();
    console.log(`🗑️ Cola limpiada. ${size} items removidos`);
  }
}

// Instancia singleton
const queueManager = new QueueManager();

// Funciones de conveniencia para usar desde otros módulos
export const addToQueue = (sku, reason) => queueManager.addToQueue(sku, reason);
export const addManyToQueue = (skus, reason) => queueManager.addManyToQueue(skus, reason);
export const getQueueStatus = () => queueManager.getStatus();
export const clearQueue = () => queueManager.clearQueue();
export const startQueueProcessing = () => queueManager.startProcessing();
export const stopQueueProcessing = () => queueManager.stopProcessing();

export default queueManager;