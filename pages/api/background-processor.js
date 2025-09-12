// pages/api/background-processor.js - Procesador en segundo plano para cálculos pesados
import { supabase } from '../../lib/supabaseClient';
import cache from '../../lib/cache';

// Background job queue
class BackgroundProcessor {
  constructor() {
    this.jobs = new Map();
    this.isProcessing = false;
    this.processingInterval = null;
  }

  addJob(jobId, jobType, data, priority = 1) {
    this.jobs.set(jobId, {
      id: jobId,
      type: jobType,
      data: data,
      priority: priority,
      createdAt: Date.now(),
      status: 'pending'
    });
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing();
    }
    
    return jobId;
  }

  startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    console.log('🚀 Background processor started');
    
    this.processingInterval = setInterval(async () => {
      if (this.jobs.size === 0) {
        this.stopProcessing();
        return;
      }
      
      // Get highest priority job
      const sortedJobs = Array.from(this.jobs.values())
        .filter(job => job.status === 'pending')
        .sort((a, b) => b.priority - a.priority);
      
      if (sortedJobs.length === 0) {
        this.stopProcessing();
        return;
      }
      
      const job = sortedJobs[0];
      await this.processJob(job);
      
    }, 1000); // Process every second
  }

  stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isProcessing = false;
    console.log('⏹️ Background processor stopped');
  }

  async processJob(job) {
    try {
      console.log(`⚙️ Processing job ${job.id} (${job.type})`);
      job.status = 'processing';
      job.startedAt = Date.now();
      
      switch (job.type) {
        case 'calculate_venta_diaria_batch':
          await this.calculateVentaDiariaBatch(job);
          break;
        case 'preload_analysis':
          await this.preloadAnalysis(job);
          break;
        case 'cleanup_cache':
          await this.cleanupCache(job);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }
      
      job.status = 'completed';
      job.completedAt = Date.now();
      job.duration = job.completedAt - job.startedAt;
      
      console.log(`✅ Job ${job.id} completed in ${job.duration}ms`);
      
      // Remove completed job after 5 minutes
      setTimeout(() => {
        this.jobs.delete(job.id);
      }, 5 * 60 * 1000);
      
    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error);
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = Date.now();
    }
  }

  async calculateVentaDiariaBatch(job) {
    const { skus } = job.data;
    
    // Batch calculate venta diaria for all SKUs
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    const { data: compras } = await supabase
      .from('compras')
      .select('sku, fecha_llegada_real')
      .in('sku', skus)
      .not('fecha_llegada_real', 'is', null)
      .lte('fecha_llegada_real', hace30Dias.toISOString());

    const { data: ventas } = await supabase
      .from('ventas')
      .select('sku, fecha_venta, cantidad')
      .in('sku', skus);

    // Process each SKU and cache results
    for (const sku of skus) {
      try {
        const skuCompras = compras?.filter(c => c.sku === sku) || [];
        const skuVentas = ventas?.filter(v => v.sku === sku) || [];
        
        let fechaInicio = null;
        if (skuCompras.length > 0) {
          fechaInicio = new Date(skuCompras[0].fecha_llegada_real);
        } else if (skuVentas.length > 0) {
          fechaInicio = new Date(skuVentas[0].fecha_venta);
        }
        
        if (!fechaInicio) {
          const result = { ventaDiaria: 0, fechasAnalisis: null };
          cache.set(`venta_diaria_${sku}`, result, 60 * 60 * 1000); // 1 hour cache
          continue;
        }
        
        const fechaFin = new Date();
        const diffTime = fechaFin.getTime() - fechaInicio.getTime();
        const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        
        const ventasEnPeriodo = skuVentas.filter(v => {
          const ventaDate = new Date(v.fecha_venta);
          return ventaDate >= fechaInicio && ventaDate <= fechaFin;
        });
        
        const totalVendido = ventasEnPeriodo.reduce((sum, venta) => sum + (venta.cantidad || 0), 0);
        const ventaDiaria = totalVendido / diffDays;
        
        const result = {
          ventaDiaria,
          fechasAnalisis: {
            fechaInicio: fechaInicio,
            fechaFin: fechaFin,
            diasPeriodo: diffDays,
            unidadesVendidas: totalVendido
          }
        };
        
        // Cache for 1 hour
        cache.set(`venta_diaria_${sku}`, result, 60 * 60 * 1000);
        
      } catch (skuError) {
        console.error(`Error processing SKU ${sku}:`, skuError);
        cache.set(`venta_diaria_${sku}`, { ventaDiaria: 0, fechasAnalisis: null }, 30 * 60 * 1000);
      }
    }
  }

  async preloadAnalysis(job) {
    const { offset, limit } = job.data;
    
    // Preload next batch of products
    const { data: products } = await supabase
      .from('products')
      .select('sku, stock_actual')
      .range(offset, offset + limit - 1)
      .order('sku', { ascending: true });
    
    if (products && products.length > 0) {
      const skus = products.map(p => p.sku);
      
      // Schedule venta diaria calculation
      const jobId = `venta_diaria_batch_${Date.now()}`;
      this.addJob(jobId, 'calculate_venta_diaria_batch', { skus }, 2);
    }
  }

  async cleanupCache(job) {
    cache.cleanup();
    console.log('🧹 Cache cleanup completed');
  }

  getJobStatus(jobId) {
    return this.jobs.get(jobId) || null;
  }

  getStats() {
    const jobs = Array.from(this.jobs.values());
    return {
      totalJobs: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      isProcessing: this.isProcessing,
      jobs: jobs.slice(-10) // Last 10 jobs
    };
  }
}

// Global processor instance
const processor = new BackgroundProcessor();

export default async function handler(req, res) {
  try {
    const { action, ...params } = req.body || {};
    const { action: queryAction, jobId } = req.query || {};
    const currentAction = action || queryAction;
    
    switch (currentAction) {
      case 'schedule_preload':
        const { offset, limit } = params;
        const jobId = `preload_${Date.now()}`;
        processor.addJob(jobId, 'preload_analysis', { offset: offset || 0, limit: limit || 50 }, 1);
        return res.json({ success: true, jobId, message: 'Preload scheduled' });
        
      case 'schedule_venta_diaria':
        const { skus } = params;
        const ventaJobId = `venta_diaria_${Date.now()}`;
        processor.addJob(ventaJobId, 'calculate_venta_diaria_batch', { skus }, 3);
        return res.json({ success: true, jobId: ventaJobId, message: 'Venta diaria calculation scheduled' });
        
      case 'cleanup_cache':
        const cleanupJobId = `cleanup_${Date.now()}`;
        processor.addJob(cleanupJobId, 'cleanup_cache', {}, 1);
        return res.json({ success: true, jobId: cleanupJobId, message: 'Cache cleanup scheduled' });
        
      case 'job_status':
        const status = processor.getJobStatus(jobId);
        return res.json({ success: true, status });
        
      case 'stats':
        const stats = processor.getStats();
        return res.json({ success: true, stats });
        
      default:
        return res.json({ 
          success: true, 
          message: 'Background processor is running',
          stats: processor.getStats()
        });
    }
    
  } catch (error) {
    console.error('Background processor error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}