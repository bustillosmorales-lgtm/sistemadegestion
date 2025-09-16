// scripts/upload-archivos-admin.js
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Crear cliente con service key (admin)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Error: SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridos')
  console.log('Configura estas variables en tu archivo .env.local:')
  console.log('NEXT_PUBLIC_SUPABASE_URL=tu_url_aqui')
  console.log('SUPABASE_SERVICE_KEY=tu_service_key_aqui')
  process.exit(1)
}

console.log('🔑 URL:', supabaseUrl ? '✅ Configurado' : '❌ Falta')
console.log('🔑 Service Key:', serviceKey ? `✅ Configurado (${serviceKey.substring(0, 50)}...)` : '❌ Falta')
console.log('🔍 Debug - Key length:', serviceKey ? serviceKey.length : 0)
console.log('🔍 Debug - Key valid JWT format:', serviceKey && serviceKey.split('.').length === 3)

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
    
    // Verificar que la carpeta existe
    if (!fs.existsSync(archivosPath)) {
      console.error('❌ Carpeta archivos no encontrada:', archivosPath)
      return
    }

    // Leer todos los archivos de la carpeta
    const files = fs.readdirSync(archivosPath)
    console.log('📁 Archivos encontrados:', files)

    if (files.length === 0) {
      console.log('📂 No hay archivos para subir')
      return
    }

    // Crear bucket si no existe (con permisos de admin)
    console.log('🪣 Verificando/creando bucket con permisos de admin...')
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets()
      const bucketExists = buckets.some(bucket => bucket.name === 'archivos')
      
      if (!bucketExists) {
        console.log('🪣 Creando bucket "archivos"...')
        const { error: bucketError } = await supabaseAdmin.storage.createBucket('archivos', {
          public: false,
          fileSizeLimit: 50 * 1024 * 1024, // 50MB
          allowedMimeTypes: [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
          ]
        })
        
        if (bucketError) {
          console.error('❌ Error creando bucket:', bucketError)
          return
        }
        console.log('✅ Bucket creado exitosamente')
      } else {
        console.log('✅ Bucket ya existe')
      }
    } catch (err) {
      console.log('⚠️ Error verificando buckets:', err.message)
    }

    // Subir cada archivo
    console.log('📤 Iniciando upload de archivos con permisos de admin...')
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
        data: data,
        error: error?.message
      })
    }

    // Resumen
    const successful = uploadResults.filter(r => r.success).length
    const failed = uploadResults.filter(r => !r.success).length

    console.log('\n📊 RESUMEN DEL UPLOAD:')
    console.log(`✅ Archivos subidos exitosamente: ${successful}`)
    console.log(`❌ Archivos fallidos: ${failed}`)
    console.log(`📁 Total de archivos: ${files.length}`)

    if (failed > 0) {
      console.log('\n❌ Archivos que fallaron:')
      uploadResults.filter(r => !r.success).forEach(r => {
        console.log(`   - ${r.filename}: ${r.error}`)
      })
    }

    // Listar archivos en el bucket para verificar
    console.log('\n📋 Verificando archivos en Supabase Storage...')
    const { data: storageFiles } = await supabaseAdmin.storage.from('archivos').list()
    if (storageFiles) {
      console.log('📁 Archivos en Storage:')
      storageFiles.forEach(file => {
        console.log(`   - ${file.name} (${(file.metadata.size / 1024 / 1024).toFixed(2)} MB)`)
      })
    }

  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

uploadArchivos()