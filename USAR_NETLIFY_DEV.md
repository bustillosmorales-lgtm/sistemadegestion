# Usar Netlify Dev en lugar de npm run dev

## ¿Por qué?

`npm run dev` corre Next.js pero las Netlify Functions no tienen acceso a las variables de entorno.

`netlify dev` corre todo el entorno (Next.js + Functions) con las variables de .env.local cargadas.

## Cómo usarlo:

```bash
# Detener el servidor actual (Ctrl+C si está corriendo)

# Iniciar con Netlify CLI
netlify dev
```

Esto abrirá automáticamente en http://localhost:8888 (no :3000)

Las Netlify Functions ahora tendrán acceso al SUPABASE_SERVICE_KEY y podrán insertar datos aunque RLS esté habilitado.

## ¿Cuál usar?

**Para desarrollo:**
- Si solo estás trabajando en el frontend → `npm run dev` (más rápido)
- Si necesitas las Functions (subir Excel) → `netlify dev`

**Para producción:**
- Netlify maneja todo automáticamente
