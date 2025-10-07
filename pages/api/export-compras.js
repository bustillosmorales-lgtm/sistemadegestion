// pages/api/export-compras.js
import { supabase } from '../../lib/supabaseClient';
import XLSX from 'xlsx';

export const config = {
  api: {
    responseLimit: false,
  },
  maxDuration: 60,
};

export default async function handler(req, res) {
  try {
    console.log('🛒 Exportando base de datos de compras...');

    // Obtener todas las compras
    let allCompras = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: comprasBatch, error } = await supabase
        .from('compras')
        .select('*')
        .order('fecha_compra', { ascending: false })
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error('Error obteniendo compras:', error);
        throw error;
      }

      if (!comprasBatch || comprasBatch.length === 0) {
        hasMore = false;
        break;
      }

      allCompras = [...allCompras, ...comprasBatch];
      console.log(`   📦 Cargadas ${allCompras.length} compras...`);

      if (comprasBatch.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
      }
    }

    console.log(`✅ Total compras obtenidas: ${allCompras.length}`);

    // Preparar datos para Excel
    const excelData = allCompras.map(c => ({
      'ID': c.id,
      'Fecha Compra': c.fecha_compra,
      'SKU': c.sku,
      'Cantidad': c.cantidad,
      'Precio FOB (RMB)': c.precio_fob_rmb || 0,
      'Status': c.status_compra || '',
      'Container Number': c.container_number || '',
      'Fecha Llegada Estimada': c.fecha_llegada_estimada || '',
      'Fecha Llegada Real': c.fecha_llegada_real || ''
    }));

    // Crear libro de Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Auto-ajustar anchos de columnas
    const colWidths = [
      { wch: 10 }, // ID
      { wch: 12 }, // Fecha Pedido
      { wch: 15 }, // SKU
      { wch: 10 }, // Cantidad
      { wch: 15 }, // Precio FOB
      { wch: 15 }, // Total FOB
      { wch: 30 }, // Proveedor
      { wch: 15 }, // Status
      { wch: 15 }, // Contenedor
      { wch: 12 }, // Fecha Fabricación
      { wch: 12 }, // Fecha Envío
      { wch: 18 }, // Fecha Llegada Estimada
      { wch: 18 }, // Fecha Llegada Real
      { wch: 40 }  // Observaciones
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Compras');

    // Generar buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `Base_Compras_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Enviar respuesta
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    console.log(`✅ Export completed: ${filename}`);
    return res.send(buffer);
  } catch (error) {
    console.error('❌ Error exporting compras:', error);
    return res.status(500).json({ error: error.message });
  }
}
