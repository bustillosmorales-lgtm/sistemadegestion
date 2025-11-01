# 🪣 Configurar Storage Bucket "excel-uploads"

## Paso a Paso (UI de Supabase)

### **1. Ir a Storage**
```
https://supabase.com/dashboard/project/ugabltnuwwtbpyqoptdg/storage/buckets
```

---

### **2. Crear/Configurar Bucket**

**Si el bucket NO existe:**
1. Click **"New bucket"**
2. Llenar:
   - Name: `excel-uploads`
   - Public bucket: ✅ **MARCAR ESTA OPCIÓN**
   - File size limit: `52428800` (50 MB)
3. Click **"Create bucket"**

**Si el bucket YA existe:**
1. Click en **"excel-uploads"** en la lista
2. Click en el ícono **⚙️ Settings** (arriba a la derecha)
3. Verificar que **"Public bucket"** esté ✅ **MARCADO**
4. Si no está marcado, marcarlo y guardar

---

### **3. Configurar Políticas (Policies)**

1. Ir a **Storage → Policies** (pestaña superior)
   ```
   https://supabase.com/dashboard/project/ugabltnuwwtbpyqoptdg/storage/policies
   ```

2. Buscar el bucket **"excel-uploads"**

3. Click **"New Policy"**

4. **Crear 3 políticas:**

#### **Política 1: Lectura Pública**
```
Policy name: Lectura pública excel-uploads
Allowed operation: SELECT
Target roles: public
USING expression: bucket_id = 'excel-uploads'
```

#### **Política 2: Subida Pública**
```
Policy name: Subida pública excel-uploads
Allowed operation: INSERT
Target roles: public
WITH CHECK expression: bucket_id = 'excel-uploads'
```

#### **Política 3: Borrado Público**
```
Policy name: Borrado público excel-uploads
Allowed operation: DELETE
Target roles: public
USING expression: bucket_id = 'excel-uploads'
```

---

### **4. Verificar**

Para verificar que funciona, ejecuta esto en SQL Editor:

```sql
-- Verificar que el bucket existe
SELECT * FROM storage.buckets WHERE id = 'excel-uploads';

-- Deberías ver:
-- id: excel-uploads
-- public: true
```

---

## ⚡ MÉTODO RÁPIDO (Solo SQL para las tablas)

Si Storage ya está configurado como público, solo necesitas deshabilitar RLS en las tablas de datos:

**Ejecuta SOLO esto en SQL Editor:**

```sql
-- Deshabilitar RLS solo en tablas de datos (NO en storage)
ALTER TABLE ventas_historicas DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_actual DISABLE ROW LEVEL SECURITY;
ALTER TABLE transito_china DISABLE ROW LEVEL SECURITY;
ALTER TABLE compras_historicas DISABLE ROW LEVEL SECURITY;
ALTER TABLE packs DISABLE ROW LEVEL SECURITY;
ALTER TABLE skus_desconsiderar DISABLE ROW LEVEL SECURITY;
ALTER TABLE predicciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_inventario DISABLE ROW LEVEL SECURITY;
ALTER TABLE metricas_modelo DISABLE ROW LEVEL SECURITY;

-- Verificar
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Luego configura Storage desde la UI (pasos arriba).

---

## 🎯 Resumen:

1. ✅ **Ejecutar SQL** para deshabilitar RLS en tablas de datos
2. ✅ **Ir a Storage UI** y marcar bucket como "Public"
3. ✅ **Crear políticas** si es necesario (o usar bucket público)
4. ✅ **Refrescar** http://localhost:3000 y subir Excel

---

**¡No intentes modificar storage.objects desde SQL! Usa la interfaz de Supabase.**
