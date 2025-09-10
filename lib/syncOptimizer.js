// lib/syncOptimizer.js - Optimizaciones para sincronización de APIs
import { supabase } from './supabaseClient';

// Procesador de lotes para optimizar sincronización
export class BatchProcessor {
    constructor(batchSize = 10, maxConcurrency = 3) {
        this.batchSize = batchSize;
        this.maxConcurrency = maxConcurrency;
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1 segundo
    }

    // Procesar elementos en lotes con control de concurrencia
    async processBatch(items, processor, options = {}) {
        const results = {
            success: 0,
            errors: 0,
            details: [],
            totalProcessed: 0
        };

        const batches = this.createBatches(items);
        console.log(`📦 Procesando ${items.length} elementos en ${batches.length} lotes de ${this.batchSize}`);

        // Procesar lotes con concurrencia limitada
        for (let i = 0; i < batches.length; i += this.maxConcurrency) {
            const concurrentBatches = batches.slice(i, i + this.maxConcurrency);
            
            const batchPromises = concurrentBatches.map(async (batch, batchIndex) => {
                const actualBatchIndex = i + batchIndex;
                console.log(`🔄 Procesando lote ${actualBatchIndex + 1}/${batches.length} (${batch.length} elementos)`);
                
                return await this.processSingleBatch(batch, processor, actualBatchIndex, options);
            });

            const batchResults = await Promise.allSettled(batchPromises);
            
            // Consolidar resultados
            for (const batchResult of batchResults) {
                if (batchResult.status === 'fulfilled') {
                    results.success += batchResult.value.success;
                    results.errors += batchResult.value.errors;
                    results.details.push(...batchResult.value.details);
                    results.totalProcessed += batchResult.value.totalProcessed;
                } else {
                    results.errors += 1;
                    results.details.push({
                        error: 'Lote completo falló',
                        details: batchResult.reason?.message || 'Error desconocido'
                    });
                }
            }
        }

        console.log(`✅ Procesamiento completo: ${results.success} exitosos, ${results.errors} errores`);
        return results;
    }

    // Crear lotes de elementos
    createBatches(items) {
        const batches = [];
        for (let i = 0; i < items.length; i += this.batchSize) {
            batches.push(items.slice(i, i + this.batchSize));
        }
        return batches;
    }

    // Procesar un lote individual con reintentos
    async processSingleBatch(batch, processor, batchIndex, options) {
        const results = {
            success: 0,
            errors: 0,
            details: [],
            totalProcessed: 0
        };

        for (const item of batch) {
            let success = false;
            let lastError = null;

            // Reintentos con backoff exponencial
            for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
                try {
                    await processor(item, { batchIndex, attempt, ...options });
                    results.success++;
                    results.totalProcessed++;
                    success = true;
                    break;
                } catch (error) {
                    lastError = error;
                    if (attempt < this.retryAttempts) {
                        const delay = this.retryDelay * Math.pow(2, attempt - 1);
                        console.log(`⚠️ Error en intento ${attempt}/${this.retryAttempts}, reintentando en ${delay}ms: ${error.message}`);
                        await this.sleep(delay);
                    }
                }
            }

            if (!success) {
                results.errors++;
                results.totalProcessed++;
                results.details.push({
                    item: this.sanitizeItemForLog(item),
                    error: lastError?.message || 'Error desconocido',
                    attempts: this.retryAttempts
                });
            }
        }

        return results;
    }

    // Sanitizar elemento para logging (remover datos sensibles)
    sanitizeItemForLog(item) {
        if (typeof item === 'object' && item !== null) {
            const sanitized = { ...item };
            // Remover campos sensibles
            delete sanitized.access_token;
            delete sanitized.refresh_token;
            delete sanitized.api_key;
            return sanitized;
        }
        return item;
    }

    // Utilidad para pausa/delay
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Cache inteligente para reducir llamadas a APIs
export class SyncCache {
    constructor(ttl = 300000) { // 5 minutos por defecto
        this.cache = new Map();
        this.ttl = ttl;
    }

    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expires) {
            this.cache.delete(key);
            return null;
        }

        return entry.value;
    }

    set(key, value) {
        this.cache.set(key, {
            value,
            expires: Date.now() + this.ttl
        });
    }

    has(key) {
        return this.get(key) !== null;
    }

    clear() {
        this.cache.clear();
    }

    // Limpiar entradas expiradas
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expires) {
                this.cache.delete(key);
            }
        }
    }
}

// Monitor de salud de APIs
export class APIHealthMonitor {
    constructor() {
        this.healthStatus = {
            mercadolibre: { healthy: true, lastCheck: null, errorCount: 0 },
            defontana: { healthy: true, lastCheck: null, errorCount: 0 }
        };
        this.maxErrors = 5;
        this.checkInterval = 30000; // 30 segundos
    }

    // Reportar error en API
    reportError(platform, error) {
        if (!this.healthStatus[platform]) return;

        this.healthStatus[platform].errorCount++;
        this.healthStatus[platform].lastCheck = new Date().toISOString();

        if (this.healthStatus[platform].errorCount >= this.maxErrors) {
            this.healthStatus[platform].healthy = false;
            console.error(`🚨 API ${platform} marcada como no saludable después de ${this.maxErrors} errores`);
            
            // Log a la base de datos
            this.logHealthIssue(platform, error);
        }
    }

    // Reportar éxito en API
    reportSuccess(platform) {
        if (!this.healthStatus[platform]) return;

        this.healthStatus[platform].errorCount = Math.max(0, this.healthStatus[platform].errorCount - 1);
        this.healthStatus[platform].lastCheck = new Date().toISOString();

        if (!this.healthStatus[platform].healthy && this.healthStatus[platform].errorCount === 0) {
            this.healthStatus[platform].healthy = true;
            console.log(`✅ API ${platform} restaurada a estado saludable`);
        }
    }

    // Verificar si API está saludable
    isHealthy(platform) {
        return this.healthStatus[platform]?.healthy || false;
    }

    // Obtener estado general
    getStatus() {
        return { ...this.healthStatus };
    }

    // Log de problemas de salud
    async logHealthIssue(platform, error) {
        try {
            await supabase.from('sync_logs').insert({
                platform: platform,
                sync_type: 'health_issue',
                results: {
                    healthy: false,
                    error_count: this.healthStatus[platform].errorCount,
                    error_message: error?.message || 'Error desconocido'
                },
                error_message: `API ${platform} no saludable`,
                created_at: new Date().toISOString()
            });
        } catch (logError) {
            console.error('Error logging health issue:', logError);
        }
    }
}

// Limiter de velocidad para respetar límites de API
export class RateLimiter {
    constructor(requestsPerMinute = 60) {
        this.requestsPerMinute = requestsPerMinute;
        this.requestTimes = [];
    }

    // Esperar hasta que sea seguro hacer una request
    async waitForSlot() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;

        // Limpiar requests viejas
        this.requestTimes = this.requestTimes.filter(time => time > oneMinuteAgo);

        // Si estamos en el límite, esperar
        if (this.requestTimes.length >= this.requestsPerMinute) {
            const oldestRequest = this.requestTimes[0];
            const waitTime = 60000 - (now - oldestRequest) + 100; // +100ms buffer
            
            if (waitTime > 0) {
                console.log(`⏳ Rate limit: esperando ${waitTime}ms`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return this.waitForSlot(); // Recursivo para revisar de nuevo
            }
        }

        // Registrar esta request
        this.requestTimes.push(now);
    }
}

// Instancias globales para reutilización
export const globalCache = new SyncCache();
export const healthMonitor = new APIHealthMonitor();
export const rateLimiter = new RateLimiter(50); // 50 requests por minuto por defecto

// Función utilitaria para sync optimizado
export async function optimizedSync(platform, items, processor, options = {}) {
    const batchProcessor = new BatchProcessor(
        options.batchSize || 10,
        options.maxConcurrency || 3
    );

    // Verificar salud de API antes de procesar
    if (!healthMonitor.isHealthy(platform)) {
        throw new Error(`API ${platform} no está saludable, omitiendo sincronización`);
    }

    // Wrapper del processor para incluir rate limiting y health monitoring
    const optimizedProcessor = async (item, processorOptions) => {
        try {
            await rateLimiter.waitForSlot();
            const result = await processor(item, processorOptions);
            healthMonitor.reportSuccess(platform);
            return result;
        } catch (error) {
            healthMonitor.reportError(platform, error);
            throw error;
        }
    };

    return await batchProcessor.processBatch(items, optimizedProcessor, options);
}