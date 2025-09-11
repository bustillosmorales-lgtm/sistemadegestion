// scripts/upload-simple.js
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Variables hardcoded temporalmente para testing
const supabaseUrl = 'https://ugabltnuwwtbpyqoptdg.supabase.co'
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnYWJsdG51d3d0YnB5cW9wdGRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQxMzg2NiwiZXhwIjoyMDcxOTg5ODY2fQ.UadJZDDy1ovJkNJ6EtyIFUasVECrNm4bHPPYXSJqbuE'

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function uploadArchivos() {
  try {
    const archivosPath = path.join(__dirname, '..', '..', 'archivos')
    
    console.log('🔍 Buscando archivos en:', archivosPath)
    
    if (!fs.existsSync(archivosPath)) {
      console.error('❌ Carpeta archivos no encontrada:', archivosPath)
      return
    }

    const files = fs.readdirSync(archivosPath)
    console.log('📁 Archivos encontrados:', files)

    if (files.length === 0) {
      console.log('📂 No hay archivos para subir')
      return
    }

    // Verificar conexión
    console.log('🔑 Testing connection...')
    const { data: test } = await supabaseAdmin.storage.listBuckets()
    console.log('🔑 Connection test:', test ? 'Success' : 'Failed')

    // Subir cada archivo directamente
    console.log('📤 Iniciando upload de archivos...')
    const uploadResults = []

    for (const filename of files) {
      const filePath = path.join(archivosPath, filename)
      const fileBuffer = fs.readFileSync(filePath)
      const fileSize = (fileBuffer.length / 1024 / 1024).toFixed(2)
      
      console.log(`📤 Subiendo ${filename} (${fileSize} MB)...`)
      
      const { data, error } = await supabaseAdmin.storage
        .from('archivos')
        .upload(filename, fileBuffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: true
        })

      if (error) {
        console.error(`❌ Error subiendo ${filename}:`, error.message)
      } else {
        console.log(`✅ ${filename} subido exitosamente`)
      }

      uploadResults.push({
        filename,
        success: !error,
        error: error?.message
      })
    }

    // Resumen
    const successful = uploadResults.filter(r => r.success).length
    console.log(`\n📊 ${successful}/${files.length} archivos subidos exitosamente`)

  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

uploadArchivos()