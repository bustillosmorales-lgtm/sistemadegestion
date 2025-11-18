# 🔄 Configuración de Sincronización Automática Defontana

## ✅ Lo que hace este sistema:

- 🕐 Se ejecuta **todos los días a las 2 AM** (hora Chile)
- 📥 Sincroniza automáticamente las ventas del día anterior
- 📊 Genera reportes de cada ejecución
- 🚨 Te notifica si algo falla
- ▶️ Puedes ejecutarlo manualmente cuando quieras

---

## 📋 Configuración (solo una vez)

### Paso 1: Crear usuario de sistema en Supabase

1. **Ve a tu proyecto en Supabase**
2. **Authentication → Users**
3. **Add User → Create new user**
4. **Datos del usuario:**
   ```
   Email: sync-bot@tuempresa.cl
   Password: [genera una contraseña segura]
   Auto Confirm User: ✅ (activar)
   ```
5. **Guarda este email y password** (los necesitarás en el Paso 2)

### Paso 2: Configurar Secrets en GitHub

1. **Ve a tu repositorio en GitHub**
2. **Settings → Secrets and variables → Actions**
3. **Click en "New repository secret"**
4. **Crea estos 4 secrets:**

   **Secret 1: `SUPABASE_URL`**
   ```
   Nombre: SUPABASE_URL
   Valor: https://[tu-proyecto].supabase.co
   ```

   **Secret 2: `SUPABASE_ANON_KEY`**
   ```
   Nombre: SUPABASE_ANON_KEY
   Valor: [tu anon key de Supabase]
   ```
   📍 *Encuéntrala en: Supabase → Project Settings → API → anon public*

   **Secret 3: `SYNC_USER_EMAIL`**
   ```
   Nombre: SYNC_USER_EMAIL
   Valor: sync-bot@tuempresa.cl
   ```
   📍 *El email del usuario que creaste en Paso 1*

   **Secret 4: `SYNC_USER_PASSWORD`**
   ```
   Nombre: SYNC_USER_PASSWORD
   Valor: [la contraseña del usuario del Paso 1]
   ```

   **Secret 5: `NETLIFY_SITE_URL`**
   ```
   Nombre: NETLIFY_SITE_URL
   Valor: https://[tu-sitio].netlify.app
   ```
   📍 *Tu URL de producción en Netlify*

### Paso 3: Activar el workflow

1. **Haz commit y push del archivo:**
   ```bash
   git add .github/workflows/defontana-sync-daily.yml
   git commit -m "Add: Sincronización automática diaria Defontana"
   git push
   ```

2. **Verifica en GitHub:**
   - Ve a **Actions** en tu repositorio
   - Deberías ver el workflow "Sincronización Diaria Defontana"

---

## 🎮 Cómo usar

### Ejecución Automática
✅ **No tienes que hacer nada**
El sistema se ejecuta automáticamente todos los días a las 2 AM

### Ejecución Manual

1. **Ve a tu repo → Actions**
2. **Click en "Sincronización Diaria Defontana"**
3. **Run workflow → Run workflow**
4. **Opcional:** Cambia "días hacia atrás" si quieres sincronizar más días
   - `1` = ayer (default)
   - `7` = últimos 7 días
   - `30` = último mes

---

## 📊 Monitoreo

### Ver resultados de ejecuciones:

1. **GitHub → Actions**
2. **Click en cualquier ejecución**
3. **Ver resumen con:**
   - ✅ Estado (exitoso/fallido)
   - 📦 Documentos procesados
   - 📋 Líneas de venta importadas
   - 🏷️  SKUs actualizados
   - ⏱️  Tiempo de ejecución

### Ver logs detallados:

1. **Click en el job "sync-defontana-sales"**
2. **Expande cada paso para ver logs completos**

### Notificaciones:

- ✅ Si todo va bien: no recibes notificación
- ❌ Si falla: GitHub te envía email automáticamente

---

## 🔧 Personalización

### Cambiar horario de ejecución:

Edita `.github/workflows/defontana-sync-daily.yml`:

```yaml
schedule:
  - cron: '0 5 * * *'  # 5 AM UTC = 2 AM Chile
```

**Ejemplos de horarios:**
```yaml
- cron: '0 9 * * *'   # 6 AM Chile
- cron: '0 12 * * *'  # 9 AM Chile
- cron: '0 15 * * *'  # 12 PM Chile
- cron: '0 18 * * *'  # 3 PM Chile
```

**Calculadora de cron:** https://crontab.guru/

### Sincronizar más días:

Cambia el valor default en el workflow:
```yaml
days_back:
  default: '7'  # Últimos 7 días en vez de 1
```

---

## 🆘 Solución de problemas

### Error: "No se pudo obtener token"
**Causa:** Email o password del usuario incorrecto
**Solución:** Verifica los secrets `SYNC_USER_EMAIL` y `SYNC_USER_PASSWORD`

### Error: "HTTP 401 Unauthorized"
**Causa:** Token inválido o expirado
**Solución:** Verifica que el usuario existe en Supabase Auth

### Error: "HTTP 404 Not Found"
**Causa:** URL de Netlify incorrecta
**Solución:** Verifica el secret `NETLIFY_SITE_URL`

### Error: "Defontana no está configurado"
**Causa:** Credenciales de Defontana no guardadas
**Solución:** Configura Defontana desde la UI primero

### El workflow no se ejecuta
**Causa:** Branch principal no está activo
**Solución:** Asegúrate de que el workflow está en la rama `main`

---

## 📈 Mejoras futuras disponibles

Si quieres, puedo agregar:

- 📧 Notificaciones por email con resumen
- 💬 Notificaciones a Slack/Discord
- 📊 Dashboard de métricas de sincronización
- 🔄 Retry automático en caso de fallo
- 📅 Sincronización por rango de fechas personalizado
- 🎯 Sincronización solo de SKUs específicos

---

## ✅ Checklist de configuración

- [ ] Usuario de sistema creado en Supabase
- [ ] 5 secrets configurados en GitHub
- [ ] Workflow pusheado a repositorio
- [ ] Workflow visible en GitHub Actions
- [ ] Primera ejecución manual exitosa
- [ ] Defontana configurado en la UI

**Una vez completado, el sistema sincronizará automáticamente todos los días** 🎉
