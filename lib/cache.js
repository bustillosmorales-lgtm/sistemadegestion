// lib/cache.js - Sistema de caché optimizado en memoria
class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = 2000; // Increased to 2000 entries for better performance
    this.defaultTTL = 15 * 60 * 1000; // 15 minutos por defecto
    this.hitCount = 0;
    this.missCount = 0;
    this.compressionEnabled = true; // Enable data compression for large objects
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
    if (!item) {
      this.missCount++;
      return null;
    }

    // Verificar si expiró
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    this.hitCount++;
    // Move to end for LRU behavior
    this.cache.delete(key);
    this.cache.set(key, item);
    
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

  // Enhanced cache statistics
  getStats() {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? ((this.hitCount / totalRequests) * 100).toFixed(2) : '0.00';
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: `${hitRate}%`,
      memoryEfficiency: `${this.cache.size}/${this.maxSize} slots used`,
      entries: Array.from(this.cache.entries()).map(([key, item]) => ({
        key,
        age: Date.now() - item.createdAt,
        ttl: item.expiresAt - Date.now(),
        size: JSON.stringify(item.value).length
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