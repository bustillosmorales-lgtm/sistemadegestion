// pages/api/job-status.js
// Endpoint para consultar el estado de un job asíncrono

import { createClient } from '@supabase/supabase-js';

// Usar service key para acceso completo
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const config = {
  maxDuration: 5, // Rápido - OK para Netlify Free
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { job_id } = req.query;

  if (!job_id) {
    return res.status(400).json({
      error: 'Missing job_id parameter',
      usage: '/api/job-status?job_id=<uuid>'
    });
  }

  try {
    // Buscar job en la base de datos
    const { data: job, error } = await supabase
      .from('processing_jobs')
      .select('*')
      .eq('id', job_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Job not found',
          job_id: job_id
        });
      }

      console.error('Error fetching job:', error);
      return res.status(500).json({
        error: 'Error fetching job status',
        details: error.message
      });
    }

    // Calcular tiempo transcurrido
    const createdAt = new Date(job.created_at);
    const now = new Date();
    const elapsedSeconds = Math.floor((now - createdAt) / 1000);

    // Calcular tiempo estimado restante
    let estimatedRemainingSeconds = null;
    if (job.status === 'processing' && job.total_items > 0 && job.processed_items > 0) {
      const avgTimePerItem = elapsedSeconds / job.processed_items;
      const remainingItems = job.total_items - job.processed_items;
      estimatedRemainingSeconds = Math.floor(avgTimePerItem * remainingItems);
    }

    // Devolver respuesta formateada
    const response = {
      job_id: job.id,
      type: job.type,
      status: job.status, // "queued" | "processing" | "completed" | "failed"

      // Progreso
      progress: job.progress || 0,
      total_items: job.total_items,
      processed_items: job.processed_items || 0,

      // Tiempos
      elapsed_seconds: elapsedSeconds,
      estimated_remaining_seconds: estimatedRemainingSeconds,
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,

      // Resultados (solo si completado)
      results: job.status === 'completed' ? job.results : null,

      // Error (solo si falló)
      error_message: job.status === 'failed' ? job.error_message : null,

      // Metadata
      parameters: job.parameters,
      created_by: job.created_by
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Error in job-status endpoint:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
