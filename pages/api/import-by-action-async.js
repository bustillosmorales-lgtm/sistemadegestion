// pages/api/import-by-action-async.js
// Endpoint asíncrono para iniciar jobs de importación (Netlify Free compatible)

import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';
import { randomUUID } from 'crypto';

// Usar service key para operaciones de Storage
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 10, // 10 segundos - OK para Netlify Free
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();

  try {
    console.log('🚀 [ASYNC] Iniciando creación de job asíncrono...');

    // 1️⃣ Parsear archivo Excel (rápido)
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

    console.log(`📁 Archivo recibido: ${file.originalFilename} (${file.size} bytes)`);

    // 2️⃣ Subir archivo a Supabase Storage (2-3 segundos)
    const fileBuffer = fs.readFileSync(file.filepath);
    const fileName = `${Date.now()}-${randomUUID()}-${file.originalFilename}`;
    const filePath = `imports/${fileName}`;

    console.log(`📤 Subiendo archivo a Storage: ${filePath}`);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('job-files')
      .upload(filePath, fileBuffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Error subiendo archivo:', uploadError);
      return res.status(500).json({
        error: 'Error uploading file to storage',
        details: uploadError.message
      });
    }

    // Obtener URL pública del archivo
    const { data: urlData } = supabase.storage
      .from('job-files')
      .getPublicUrl(filePath);

    const fileUrl = urlData.publicUrl;

    console.log(`✅ Archivo subido: ${fileUrl}`);

    // 3️⃣ Crear job en tabla processing_jobs (rápido)
    const { data: job, error: jobError } = await supabase
      .from('processing_jobs')
      .insert({
        type: 'import_by_action',
        status: 'queued',
        file_url: fileUrl,
        parameters: {
          original_filename: file.originalFilename,
          file_size: file.size,
          mime_type: file.mimetype
        },
        created_by: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress
      })
      .select()
      .single();

    if (jobError) {
      console.error('❌ Error creando job:', jobError);

      // Limpiar archivo subido si falló crear el job
      await supabase.storage
        .from('job-files')
        .remove([filePath]);

      return res.status(500).json({
        error: 'Error creating job',
        details: jobError.message
      });
    }

    const elapsedTime = Date.now() - startTime;
    console.log(`✅ Job creado: ${job.id} (${elapsedTime}ms)`);

    // 4️⃣ Limpiar archivo temporal
    try {
      fs.unlinkSync(file.filepath);
    } catch (cleanupError) {
      console.warn('⚠️  Error limpiando archivo temporal:', cleanupError.message);
    }

    // 5️⃣ Devolver job_id inmediatamente (sin esperar procesamiento)
    return res.status(202).json({
      success: true,
      job_id: job.id,
      status: 'queued',
      message: 'Job creado y en cola para procesamiento',
      elapsed_time_ms: elapsedTime,
      check_status_url: `/api/job-status?job_id=${job.id}`
    });

  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    console.error(`❌ Error en async endpoint (${elapsedTime}ms):`, error);

    return res.status(500).json({
      success: false,
      error: error.message,
      elapsed_time_ms: elapsedTime
    });
  }
}
