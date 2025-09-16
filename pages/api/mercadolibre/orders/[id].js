require('dotenv').config();
const mlService = require('../../../../lib/mercadolibre-service');

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      console.log(`🔍 Obteniendo orden específica: ${id}`);
      
      // Obtener orden directamente de MercadoLibre
      const mlOrder = await mlService.getOrderById(id);
      
      // Convertir a formato interno
      const orderData = mlService.convertMlOrderToSystemFormat(mlOrder);
      
      // Guardar/actualizar en la base de datos
      await mlService.saveOrderToSystem(orderData);
      
      res.status(200).json({
        success: true,
        order: orderData,
        raw_ml_data: mlOrder
      });

    } catch (error) {
      console.error(`❌ Error obteniendo orden ${id}:`, error.response?.data || error.message);
      res.status(500).json({
        error: 'Error al obtener la orden',
        details: process.env.NODE_ENV === 'development' ? 
          (error.response?.data || error.message) : undefined
      });
    }
  } else {
    res.status(405).json({ error: 'Método no permitido' });
  }
}