# ANÁLISIS DE SEGURIDAD - SISTEMA DE FORECASTING

## RESUMEN EJECUTIVO

**Estado General:** RIESGO ALTO
- Fortalezas: Stack moderno (Next.js + Supabase), buena arquitectura de componentes
- Debilidades Críticas: Sin autenticación, credenciales expuestas, CORS abierto
- **Criticidad:** MÁXIMA - No apto para producción sin correcciones

---

## 1. ARQUITECTURA

### Stack Tecnológico
- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend:** Netlify Functions (Node.js 18)
- **BD:** Supabase (PostgreSQL gestionado)
- **ML:** Python 3.11 con scikit-learn, pandas
- **CI/CD:** GitHub Actions (ejecución diaria 2 AM UTC)
- **Hosting:** Netlify (exportación estática)

### Estructura Principal
```
/app - Componente página (dashboard)
/lib - Cliente Supabase (singleton)
/components - React components (UploadExcel, Tablas, Modales)
/netlify/functions - APIs: procesar-excel.js, predicciones.js, alertas.js
/scripts - Python: run_daily_forecast.py (pipeline ML)
```

---

## 2. VULNERABILIDADES CRÍTICAS

### CRÍTICA 1: Credenciales Expuestas en Repositorio
**Archivo:** `.env.local` (en GitHub público)

**Contenido Comprometido:**
```
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6InNlcnZpY2Vfcm9sZSI...
ML_CLIENT_SECRET=OTmz6Hsh7lCjdovoFZf3RauEfD4gjgc0
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Impacto:**
- Service Key = Acceso TOTAL a BD (leer/escribir/borrar)
- ML Secret = Autenticación como app en MercadoLibre
- Historic visible en git history (permanente)

---

### CRÍTICA 2: Sin Autenticación
**Archivos afectados:** Todas las APIs y el dashboard

- ✗ No hay login/signup
- ✗ Cualquiera accede a todas las APIs
- ✗ Sin verificación de permisos
- ✗ Sin auditoría

**Riesgo:** Competidores scrapean predicciones, exposición de datos sensibles

---

### CRÍTICA 3: CORS Completamente Abierto
**Todas las funciones Netlify:**
```javascript
'Access-Control-Allow-Origin': '*'  // CUALQUIER ORIGEN
```

**Riesgo:** Sitios maliciosos pueden llamar APIs desde navegador del usuario

---

### ALTA 4: Validación de Inputs Débil
- Solo valida extensión de archivo (no contenido)
- Sin límite de tamaño de archivos
- Sin validación de rangos en parámetros
- Sin sanitización de paths

---

### ALTA 5: Logging Excesivo en Producción
- 47 console.log/error en procesar-excel.js
- Expone estructura interna y datos sensibles
- Stack traces completos en errores

---

### MEDIA 6: RLS No Implementado
```sql
ALTER TABLE predicciones ENABLE ROW LEVEL SECURITY;
-- Pero sin políticas reales, solo GRANT abierto:
GRANT SELECT ON predicciones TO anon;  -- Público total
```

---

## 3. ENDPOINTS SIN PROTECCIÓN

| Endpoint | Método | Acceso | Riesgo |
|----------|--------|--------|--------|
| `/.netlify/functions/predicciones` | GET | Público | Exposición competitiva |
| `/.netlify/functions/alertas` | GET | Público | Información crítica |
| `/.netlify/functions/procesar-excel` | POST | Público | Inyección de datos |

---

## 4. PLAN DE ACCIÓN PARA PRODUCCIÓN

### FASE 1: CRÍTICA (Esta semana)
1. **Revocar credenciales** en Supabase Console
2. **Remover .env.local** del git history
3. **Actualizar GitHub Secrets**
4. **Implementar autenticación básica** en APIs
5. **Restringir CORS** a dominio específico

### FASE 2: ALTA (Próximas 2 semanas)
6. **Autenticación real** (NextAuth.js o Supabase Auth)
7. **Validación robusta** (Zod schema)
8. **Remover console.log** de producción
9. **Rate limiting** en APIs

### FASE 3: MEDIA (Plan 1 mes)
10. **RLS en Supabase** con políticas reales
11. **Headers de seguridad** en netlify.toml
12. **npm audit en CI/CD**
13. **Logging centralizado** (Sentry)

---

## 5. CONCLUSIÓN

**Sistema es FUNCIONAL pero NO LISTO PARA PRODUCCIÓN**

Tiempo estimado para implementar seguridad básica: **2-3 semanas**
Tiempo para seguridad en producción: **4-6 semanas**

**Próximo paso:** Implementar soluciones siguiendo las fases de prioridad
