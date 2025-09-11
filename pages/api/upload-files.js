// pages/api/upload-files.js
import { supabase } from '../../lib/supabaseClient'
import fs from 'fs'
import path from 'path'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const archivosPath = path.join(process.cwd(), '..', 'archivos')
    
    // Verificar que la carpeta existe
    if (!fs.existsSync(archivosPath)) {
      return res.status(404).json({ error: 'Carpeta archivos no encontrada' })
    }

    // Leer todos los archivos de la carpeta
    const files = fs.readdirSync(archivosPath)
    const uploadResults = []

    // Crear bucket si no existe
    const { data: buckets } = await supabase.storage.listBuckets()
    const bucketExists = buckets.some(bucket => bucket.name === 'archivos')
    
    if (!bucketExists) {
      const { error: bucketError } = await supabase.storage.createBucket('archivos', {
        public: false,
        fileSizeLimit: 50 * 1024 * 1024, // 50MB
        allowedMimeTypes: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel'
        ]
      })
      
      if (bucketError) {
        return res.status(500).json({ error: 'Error creando bucket', details: bucketError })
      }
    }

    // Subir cada archivo
    for (const filename of files) {
      const filePath = path.join(archivosPath, filename)
      const fileBuffer = fs.readFileSync(filePath)
      
      const { data, error } = await supabase.storage
        .from('archivos')
        .upload(filename, fileBuffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: true
        })

      uploadResults.push({
        filename,
        success: !error,
        data: data,
        error: error?.message
      })
    }

    return res.status(200).json({
      message: 'Upload completado',
      results: uploadResults,
      totalFiles: files.length,
      successfulUploads: uploadResults.filter(r => r.success).length
    })

  } catch (error) {
    console.error('Error en upload:', error)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
}