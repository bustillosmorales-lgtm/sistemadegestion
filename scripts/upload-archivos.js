// scripts/upload-archivos.js
import { supabase } from '../lib/supabaseClient.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

    // Verificar bucket (no crear, solo listar para verificar acceso)
    console.log('🪣 Verificando acceso a Storage...')
    try {
      const { data: buckets, error } = await supabase.storage.listBuckets()
      if (error) {
        console.log('⚠️ No se puede acceder a los buckets, intentando subir directamente...')
      } else {
        const bucketExists = buckets.some(bucket => bucket.name === 'archivos')
        if (bucketExists) {
          console.log('✅ Bucket "archivos" encontrado')
        } else {
          console.log('⚠️ Bucket "archivos" no encontrado, pero intentaremos subir archivos...')
        }
      }
    } catch (err) {
      console.log('⚠️ Error verificando buckets:', err.message)
      console.log('🔄 Continuando con el upload...')
    }

    // Subir cada archivo
    console.log('📤 Iniciando upload de archivos...')
    const uploadResults = []

    for (const filename of files) {
      const filePath = path.join(archivosPath, filename)
      const fileBuffer = fs.readFileSync(filePath)
      const fileSize = (fileBuffer.length / 1024 / 1024).toFixed(2)
      
      console.log(`📤 Subiendo ${filename} (${fileSize} MB)...`)
      
      const { data, error } = await supabase.storage
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
    const { data: storageFiles } = await supabase.storage.from('archivos').list()
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