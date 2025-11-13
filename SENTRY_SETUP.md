# Configuración de Sentry (OPCIONAL)

Sentry proporciona logging centralizado y monitoreo de errores en producción.

## 1. Crear cuenta en Sentry

1. Ve a https://sentry.io/signup/
2. Crea un nuevo proyecto Next.js
3. Copia tu DSN (Data Source Name)

## 2. Instalar dependencias

```bash
npm install --save @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

## 3. Configurar variables de entorno

Agregar a `.env.local`:

```env
NEXT_PUBLIC_SENTRY_DSN=tu_sentry_dsn_aqui
SENTRY_AUTH_TOKEN=tu_auth_token_aqui
```

## 4. Configurar en Netlify Functions

Agregar a `netlify/functions/lib/logger.js`:

```javascript
const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: 1.0,
  });
}

function logError(error, context = {}) {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  } else {
    console.error('Error:', error, context);
  }
}

function logInfo(message, data = {}) {
  if (process.env.SENTRY_DSN) {
    Sentry.captureMessage(message, {
      level: 'info',
      extra: data
    });
  }
}

module.exports = { logError, logInfo };
```

## 5. Usar en las funciones

```javascript
const { logError, logInfo } = require('./lib/logger');

try {
  // tu código
  logInfo('Operación exitosa', { userId: user.id });
} catch (error) {
  logError(error, { context: 'predicciones' });
  throw error;
}
```

## 6. Configurar en GitHub Actions

Agregar a GitHub Secrets:
- `SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`

## Beneficios de Sentry

- Alertas en tiempo real de errores
- Stack traces completos
- Performance monitoring
- Release tracking
- Error grouping automático
- Integración con Slack/email

## Alternativas gratuitas

- **Logtail** (https://logtail.com)
- **Papertrail** (https://papertrailapp.com)
- **New Relic** (https://newrelic.com)
