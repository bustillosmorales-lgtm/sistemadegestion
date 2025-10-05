// pages/api/export-ventas.js
import { supabase } from '../../lib/supabaseClient';
import XLSX from 'xlsx';

export default async function handler(req, res) {
  try {
    console.log('📊 Exportando base de datos de ventas...');

    // Obtener todas las ventas
    let allVentas = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: ventasBatch, error } = await supabase
        .from('ventas')
        .select('*')
        .order('fecha', { ascending: false })
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error('Error obteniendo ventas:', error);
        throw error;
      }

      if (!ventasBatch || ventasBatch.length === 0) {
        hasMore = false;
        break;
      }

      allVentas = [...allVentas, ...ventasBatch];
      console.log(`   📦 Cargadas ${allVentas.length} ventas...`);

      if (ventasBatch.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
      }
    }

    console.log(`✅ Total ventas obtenidas: ${allVentas.length}`);

    // Preparar datos para Excel
    const excelData = allVentas.map(v => ({
      'ID': v.id,
      'Fecha': v.fecha,
      'SKU': v.sku,
      'Cantidad': v.cantidad,
      'Precio Unitario': v.precio_unitario,
      'Total': v.total,
      'Cliente': v.cliente || '',
      'Canal': v.canal || '',
      'Observaciones': v.observaciones || ''
    }));

    // Crear libro de Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Auto-ajustar anchos de columnas
    const colWidths = [
      { wch: 10 }, // ID
      { wch: 12 }, // Fecha
      { wch: 15 }, // SKU
      { wch: 10 }, // Cantidad
      { wch: 15 }, // Precio Unitario
      { wch: 15 }, // Total
      { wch: 30 }, // Cliente
      { wch: 15 }, // Canal
      { wch: 40 }  // Observaciones
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Ventas');

    // Generar buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `Base_Ventas_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Enviar respuesta
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    console.log(`✅ Export completed: ${filename}`);
    return res.send(buffer);
  } catch (error) {
    console.error('❌ Error exporting ventas:', error);
    return res.status(500).json({ error: error.message });
  }
}
