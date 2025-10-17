// pages/api/setup-processing-jobs-table.js
// Endpoint temporal para crear la tabla processing_jobs

import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    console.log('🚀 Creando tabla processing_jobs...');

    // Usar rpc para ejecutar SQL (si tienes una función helper en Supabase)
    // O intentar crear mediante insert (lo cual creará el schema si usas Supabase edge functions)

    // Por ahora, solo verificamos si existe
    const { data: existingData, error: checkError } = await supabase
      .from('processing_jobs')
      .select('count', { count: 'exact', head: true });

    if (!checkError) {
      return res.status(200).json({
        success: true,
        message: 'La tabla processing_jobs ya existe',
        count: existingData?.count || 0
      });
    }

    // Si llegamos aquí, la tabla no existe
    return res.status(500).json({
      success: false,
      message: 'La tabla no existe. Por favor ejecuta el SQL manualmente.',
      instructions: {
        step1: 'Ve a: https://app.supabase.com/project/[tu-project-id]/sql/new',
        step2: 'Copia el contenido de: CREATE_TABLE_SIMPLE.sql',
        step3: 'Pega en el SQL Editor',
        step4: 'Click en Run',
        step5: 'Refresca esta página'
      },
      sql_file: 'CREATE_TABLE_SIMPLE.sql'
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
