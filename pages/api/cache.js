// pages/api/cache.js - Endpoint para gestionar el caché
import cache from '../../lib/cache';

export default async function handler(req, res) {
  try {
    if (req.method === 'DELETE') {
      // Limpiar todo el caché
      cache.clear();
      return res.status(200).json({ 
        success: true, 
        message: 'Caché limpiado completamente' 
      });
    }
    
    if (req.method === 'POST') {
      const { action, key } = req.body;
      
      if (action === 'clear') {
        cache.clear();
        return res.status(200).json({ 
          success: true, 
          message: 'Caché limpiado completamente' 
        });
      }
      
      if (action === 'delete' && key) {
        cache.delete(key);
        return res.status(200).json({ 
          success: true, 
          message: `Entrada '${key}' eliminada del caché` 
        });
      }
      
      if (action === 'cleanup') {
        cache.cleanup();
        return res.status(200).json({ 
          success: true, 
          message: 'Entradas expiradas eliminadas del caché' 
        });
      }
      
      return res.status(400).json({ 
        error: 'Acción no válida' 
      });
    }
    
    if (req.method === 'GET') {
      // Obtener estadísticas del caché
      const stats = cache.getStats();
      return res.status(200).json({
        success: true,
        stats: {
          ...stats,
          hitRate: 'No disponible', // Podríamos implementar esto después
          memoryUsage: `${stats.size}/${stats.maxSize} entradas`
        }
      });
    }
    
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ 
      error: `Método ${req.method} no permitido` 
    });
    
  } catch (error) {
    console.error('Error en API de caché:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor' 
    });
  }
}