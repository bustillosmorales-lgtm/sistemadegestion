// lib/dashboardPersistence.js
// Utilidades para persistir datos del dashboard en localStorage

const CACHE_KEY = 'dashboard_all_products_v2';
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 horas

export const loadFromLocalStorage = () => {
  if (typeof window === 'undefined') return null; // SSR safety

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const { data, timestamp, metadata } = JSON.parse(cached);

    // Validar que no esté expirado
    if (Date.now() - timestamp > CACHE_DURATION) {
      localStorage.removeItem(CACHE_KEY);
      console.log('🧹 Removed expired cache from localStorage');
      return null;
    }

    const ageMinutes = Math.round((Date.now() - timestamp) / 1000 / 60);
    console.log(`✅ Loaded ${data.length} products from localStorage (${ageMinutes}min old)`);

    return { data, metadata, timestamp };
  } catch (e) {
    console.error('❌ localStorage read error:', e);
    // Limpiar cache corrupto
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {}
    return null;
  }
};

export const saveToLocalStorage = (data, metadata) => {
  if (typeof window === 'undefined') return false; // SSR safety

  try {
    // Validar tamaño antes de guardar
    const payload = JSON.stringify({
      data,
      metadata,
      timestamp: Date.now()
    });

    // Límite de ~5MB para localStorage
    const sizeInMB = payload.length / 1024 / 1024;

    if (sizeInMB > 5) {
      console.warn(`⚠️ Data too large for localStorage (${sizeInMB.toFixed(2)}MB), skipping cache`);
      return false;
    }

    localStorage.setItem(CACHE_KEY, payload);
    console.log(`✅ Saved ${data.length} products to localStorage (${sizeInMB.toFixed(2)}MB)`);
    return true;

  } catch (e) {
    console.error('❌ localStorage save error:', e);

    // Si falla por QuotaExceeded, limpiar cache antiguo e intentar de nuevo
    if (e.name === 'QuotaExceededError') {
      try {
        console.log('🧹 Clearing localStorage due to quota...');
        localStorage.clear();

        // Reintentar guardado
        const payload = JSON.stringify({
          data,
          metadata,
          timestamp: Date.now()
        });
        localStorage.setItem(CACHE_KEY, payload);
        console.log('✅ Saved after clearing quota');
        return true;
      } catch (retryError) {
        console.error('❌ Failed even after clearing:', retryError);
      }
    }
    return false;
  }
};

export const clearLocalStorage = () => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(CACHE_KEY);
    console.log('🧹 Dashboard cache cleared from localStorage');
  } catch (e) {
    console.error('❌ Error clearing cache:', e);
  }
};

export const getCacheAge = () => {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const { timestamp } = JSON.parse(cached);
    return Date.now() - timestamp;
  } catch {
    return null;
  }
};
