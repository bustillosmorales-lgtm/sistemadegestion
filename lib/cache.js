// lib/cache.js - Sistema de caché simple en memoria
class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = 1000; // Máximo 1000 entradas
    this.defaultTTL = 15 * 60 * 1000; // 15 minutos por defecto
  }

  set(key, value, ttl = this.defaultTTL) {
    // Limpiar caché si está lleno
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    const expiresAt = Date.now() + ttl;
    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now()
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    // Verificar si expiró
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  // Limpiar entradas expiradas
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  // Estadísticas del caché
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      entries: Array.from(this.cache.entries()).map(([key, item]) => ({
        key,
        age: Date.now() - item.createdAt,
        ttl: item.expiresAt - Date.now()
      }))
    };
  }
}

// Instancia global del caché
const cache = new SimpleCache();

// Limpiar caché cada 5 minutos
setInterval(() => {
  cache.cleanup();
}, 5 * 60 * 1000);

export default cache;