// pages/api/export-contenedores.js
import { supabase } from '../../lib/supabaseClient';
import XLSX from 'xlsx';

export default async function handler(req, res) {
  try {
    console.log('🚢 Exportando base de datos de contenedores...');

    // Obtener todos los contenedores
    const { data: contenedores, error } = await supabase
      .from('contenedores')
      .select('*')
      .order('fecha_salida', { ascending: false });

    if (error) {
      console.error('Error obteniendo contenedores:', error);
      throw error;
    }

    console.log(`✅ Total contenedores obtenidos: ${contenedores?.length || 0}`);

    // Preparar datos para Excel
    const excelData = (contenedores || []).map(c => ({
      'ID': c.id,
      'Número Contenedor': c.numero_contenedor || '',
      'Fecha Salida': c.fecha_salida || '',
      'Fecha Llegada Estimada': c.fecha_llegada_estimada || '',
      'Fecha Llegada Real': c.fecha_llegada_real || '',
      'Puerto Origen': c.puerto_origen || '',
      'Puerto Destino': c.puerto_destino || '',
      'Naviera': c.naviera || '',
      'BL Number': c.bl_number || '',
      'Status': c.status || '',
      'CBM Total': c.cbm_total || 0,
      'Peso Total (kg)': c.peso_total_kg || 0,
      'Costo Flete (USD)': c.costo_flete_usd || 0,
      'Costo Despacho (CLP)': c.costo_despacho_clp || 0,
      'Costo Total (CLP)': c.costo_total_clp || 0,
      'Observaciones': c.observaciones || ''
    }));

    // Crear libro de Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Auto-ajustar anchos de columnas
    const colWidths = [
      { wch: 10 }, // ID
      { wch: 20 }, // Número Contenedor
      { wch: 12 }, // Fecha Salida
      { wch: 18 }, // Fecha Llegada Estimada
      { wch: 18 }, // Fecha Llegada Real
      { wch: 20 }, // Puerto Origen
      { wch: 20 }, // Puerto Destino
      { wch: 20 }, // Naviera
      { wch: 20 }, // BL Number
      { wch: 15 }, // Status
      { wch: 12 }, // CBM Total
      { wch: 15 }, // Peso Total
      { wch: 18 }, // Costo Flete
      { wch: 18 }, // Costo Despacho
      { wch: 18 }, // Costo Total
      { wch: 40 }  // Observaciones
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Contenedores');

    // Generar buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `Base_Contenedores_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Enviar respuesta
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    console.log(`✅ Export completed: ${filename}`);
    return res.send(buffer);
  } catch (error) {
    console.error('❌ Error exporting contenedores:', error);
    return res.status(500).json({ error: error.message });
  }
}
