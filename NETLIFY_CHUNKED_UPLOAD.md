# 📦 Sistema de Carga Masiva Optimizado para Netlify

## ✅ Optimizaciones Implementadas

### **Estrategia: Chunked Upload**

Para superar las limitaciones de Netlify (6 MB max, 10s timeout), implementamos:

1. **División Automática en Chunks**
   - Chunks de ~2 MB cada uno
   - Máximo 100 filas por chunk
   - Procesa en <10 segundos por chunk

2. **Procesamiento Secuencial**
   - Cada chunk se procesa independientemente
   - Si un chunk falla, continúa con el siguiente
   - Progress bar en tiempo real

3. **Batch Processing Interno**
   - Dentro de cada chunk: batches de 500 registros
   - Bulk inserts optimizados
   - Detección de duplicados en memoria

---

## 📊 Performance Esperado

### **Con Netlify Free (10s timeout):**

| Archivo | Registros | Chunks | Tiempo Total |
|---------|-----------|--------|--------------|
| Productos | 500 | ~5 | ~1 minuto |
| Compras | 2,299 | ~23 | ~3-4 minutos |
| Ventas | 174,717 | ~1,747 | **~12-15 minutos** |

**Cálculo:**
- 100 filas por chunk @ 10s = ~1,747 chunks para 174K registros
- 1,747 chunks × 0.5s pausa = ~14 minutos total

### **Con Netlify Pro (26s timeout):**

| Archivo | Registros | Chunks | Tiempo Total |
|---------|-----------|--------|--------------|
| Productos | 500 | ~3 | ~30 segundos |
| Compras | 2,299 | ~12 | ~2 minutos |
| Ventas | 174,717 | ~875 | **~7-10 minutos** |

**Mejora:** 2x más rápido que Free

---

## 🔧 Configuración Aplicada

### **netlify.toml:**
```toml
[functions]
  function_timeout = 10        # 10 segundos por función
  memory = 1769                # Máxima memoria en Free
  node_bundler = "esbuild"     # Mejor performance

[[functions."api/bulk-upload"]]
  timeout = 10                 # Específico para bulk-upload
```

### **Frontend (pages/bulk-upload.js):**
```javascript
// Chunks de 2 MB
const NETLIFY_CHUNK_SIZE = 2 * 1024 * 1024;
const maxBatchSize = Math.floor(NETLIFY_CHUNK_SIZE / avgRowSize);
const batchSize = Math.min(maxBatchSize, 100);

// Timeout de 10s por request
setTimeout(() => controller.abort(), 10000);
```

### **API (pages/api/bulk-upload.js):**
```javascript
export const config = {
  api: {
    bodyParser: { sizeLimit: '6mb' },  // Límite de Netlify
  },
  maxDuration: 10,  // 10 segundos
}
```

---

## 🎯 Ventajas del Sistema

### ✅ **Gratis Forever**
- No necesitas Netlify Pro para funcionar
- 0 costo mensual

### ✅ **Maneja Archivos Gigantes**
- No hay límite de filas total
- Solo importa el tamaño del archivo original
- Divide automáticamente

### ✅ **Robusto**
- Si un chunk falla, reintenta
- Continúa con los siguientes chunks
- No pierdes progreso

### ✅ **Transparente**
- Ves progreso en tiempo real
- Logs detallados en consola
- Sabes exactamente dónde está

---

## 🚀 Cómo Usar

### **1. Sube tu archivo Excel:**
```
/bulk-upload → Seleccionar archivo → Upload
```

### **2. El sistema automáticamente:**
- ✅ Detecta tamaño del archivo
- ✅ Calcula chunks necesarios
- ✅ Muestra estimación de tiempo
- ✅ Procesa chunk por chunk

### **3. Monitoreo:**
```
Consola del navegador (F12):
📊 [Netlify Mode] Procesando 174717 filas en 1747 chunks
📏 Tamaño estimado por chunk: 1.95 MB
🔄 Procesando lote 1/1747 (filas 1-100)
✅ Lote 1 completado: 100 nuevos, 0 duplicados
```

---

## ⚙️ Configuraciones Avanzadas

### **Ajustar Tamaño de Chunk:**

Si tienes Netlify Pro (26s timeout), puedes aumentar chunks:

**En `pages/bulk-upload.js:187`:**
```javascript
// Cambiar de:
const NETLIFY_CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB

// A:
const NETLIFY_CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB (solo con Pro)
```

Esto reduce el tiempo a la mitad (~7 minutos vs ~14 minutos).

### **Ajustar Pausa Entre Chunks:**

**En `pages/bulk-upload.js:216`:**
```javascript
// Cambiar de:
await new Promise(resolve => setTimeout(resolve, 500)); // 500ms

// A:
await new Promise(resolve => setTimeout(resolve, 200)); // 200ms (más rápido)
```

⚠️ **Cuidado:** Pausas muy cortas pueden sobrecargar Supabase.

---

## 🆚 Comparación: Netlify vs Vercel

| Característica | Netlify Free | Netlify Pro | Vercel Pro |
|----------------|--------------|-------------|------------|
| **Timeout** | 10s | 26s | 60s |
| **Request Size** | 6 MB | 6 MB | 4.5 MB |
| **Costo** | $0/mes | $19/mes | $20/mes |
| **Tiempo 174K** | ~14 min | ~8 min | ~5 min |
| **Complejidad** | Chunks | Chunks | Batches |

**Conclusión:**
- Netlify Free es **perfecto si el tiempo no importa**
- Netlify Pro es competitivo con Vercel
- Vercel Pro es mejor solo por ~3 minutos de diferencia

---

## 🐛 Troubleshooting

### **Error: "Function timeout"**

**Causa:** Chunk muy grande
**Solución:** Reduce `NETLIFY_CHUNK_SIZE` a 1 MB

### **Error: "Request entity too large"**

**Causa:** Archivo individual del Excel > 6 MB
**Solución:** Divide el Excel en 2 archivos más pequeños

### **Proceso muy lento**

**Solución 1:** Upgrade a Netlify Pro ($19/mes)
**Solución 2:** Reduce pausa entre chunks a 200ms

---

## ✅ Checklist de Deployment

Antes de hacer push a Netlify:

- [x] Código optimizado para chunks
- [x] netlify.toml configurado
- [x] Timeout de 10s en frontend
- [x] API configurada para 6 MB
- [x] Batch size óptimo (100 filas)

**Para deployar:**
```bash
git add .
git commit -m "🚀 Chunked upload optimizado para Netlify"
git push origin main
```

Netlify detectará los cambios y hará deploy automáticamente.

---

## 📈 Métricas Reales

Después de usar el sistema, anota aquí tus métricas:

```
Archivo: template_ventas (3).xlsx
Registros: 174,717
Chunks: _____
Tiempo total: _____ minutos
Errores: _____
Plan Netlify: Free / Pro
```

Esto te ayudará a decidir si vale la pena Netlify Pro o Vercel.

---

## 🎓 Cómo Funciona (Técnico)

### **Flujo del Sistema:**

```
1. Usuario sube archivo (7.39 MB, 174K filas)
   ↓
2. Frontend parse Excel → Array de objetos
   ↓
3. Calcula: 174K filas / 100 = 1,747 chunks
   ↓
4. Loop: Para cada chunk (100 filas):
   ├─ Serializa a JSON (~2 MB)
   ├─ POST /api/bulk-upload
   ├─ API procesa en <10s:
   │  ├─ Valida datos
   │  ├─ Crea productos faltantes (bulk)
   │  ├─ Verifica duplicados (bulk)
   │  └─ Inserta ventas (bulk insert 500)
   ├─ Recibe respuesta
   ├─ Actualiza progress bar
   └─ Pausa 500ms
   ↓
5. Completa todos los chunks
   ↓
6. Muestra resumen final
```

**Optimizaciones Clave:**
- **Frontend:** División inteligente en chunks
- **API:** Bulk inserts en memoria
- **DB:** Índices optimizados (SKU, fechas)

---

**Última actualización:** 2025-10-15
**Versión:** 1.0.1
**Optimizado para:** Netlify Free & Pro
