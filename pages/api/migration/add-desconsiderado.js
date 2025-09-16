// pages/api/migration/add-desconsiderado.js
import { supabase } from '../../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar si la columna ya existe
    const { data: existingProducts, error: selectError } = await supabase
      .from('products')
      .select('sku, desconsiderado')
      .limit(1);

    if (selectError) {
      // Si hay error, probablemente la columna no existe
      console.log('La columna desconsiderado no existe, creando...');
      
      // Intentar agregar la columna (esto debe hacerse desde SQL en Supabase)
      return res.status(200).json({ 
        message: 'Necesitas ejecutar este SQL en Supabase:', 
        sql: 'ALTER TABLE products ADD COLUMN desconsiderado BOOLEAN DEFAULT FALSE;'
      });
    }

    // Si llegamos aquí, la columna ya existe
    // Verificar si hay productos sin el campo desconsiderado y actualizarlos
    const { data: allProducts, error: getAllError } = await supabase
      .from('products')
      .select('sku, desconsiderado');

    if (getAllError) {
      throw new Error('Error obteniendo productos: ' + getAllError.message);
    }

    // Contar productos que necesitan actualización
    const productsToUpdate = allProducts.filter(p => p.desconsiderado === null || p.desconsiderado === undefined);
    
    if (productsToUpdate.length > 0) {
      // Actualizar todos los productos que no tienen el campo desconsiderado
      const { error: updateError } = await supabase
        .from('products')
        .update({ desconsiderado: false })
        .is('desconsiderado', null);

      if (updateError) {
        throw new Error('Error actualizando productos: ' + updateError.message);
      }

      return res.status(200).json({ 
        message: `✅ Migración completada. ${productsToUpdate.length} productos actualizados con desconsiderado: false`,
        updatedCount: productsToUpdate.length
      });
    }

    return res.status(200).json({ 
      message: '✅ Todos los productos ya tienen el campo desconsiderado configurado',
      totalProducts: allProducts.length
    });

  } catch (error) {
    console.error('Error en migración:', error);
    return res.status(500).json({ error: 'Error en migración: ' + error.message });
  }
}