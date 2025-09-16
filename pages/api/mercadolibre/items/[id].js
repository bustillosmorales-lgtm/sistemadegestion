require('dotenv').config();
const mlService = require('../../../../lib/mercadolibre-service');

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      console.log(`🏷️ Obteniendo item específico: ${id}`);
      
      // Obtener item directamente de MercadoLibre
      const mlItem = await mlService.getItemById(id);
      
      // Convertir a formato interno
      const itemData = {
        external_id: mlItem.id,
        title: mlItem.title,
        category_id: mlItem.category_id,
        price: mlItem.price,
        currency_id: mlItem.currency_id,
        available_quantity: mlItem.available_quantity,
        sold_quantity: mlItem.sold_quantity,
        condition: mlItem.condition,
        listing_type_id: mlItem.listing_type_id,
        status: mlItem.status,
        permalink: mlItem.permalink,
        thumbnail: mlItem.thumbnail,
        pictures: mlItem.pictures || [],
        attributes: mlItem.attributes || [],
        variations: mlItem.variations || [],
        shipping_info: mlItem.shipping || {},
        seller_info: mlItem.seller_id ? { id: mlItem.seller_id } : {},
        raw_data: mlItem
      };
      
      // Guardar/actualizar en la base de datos
      await mlService.saveItemToSystem(itemData);
      
      res.status(200).json({
        success: true,
        item: itemData,
        raw_ml_data: mlItem
      });

    } catch (error) {
      console.error(`❌ Error obteniendo item ${id}:`, error.response?.data || error.message);
      res.status(500).json({
        error: 'Error al obtener el item',
        details: process.env.NODE_ENV === 'development' ? 
          (error.response?.data || error.message) : undefined
      });
    }
  } else {
    res.status(405).json({ error: 'Método no permitido' });
  }
}