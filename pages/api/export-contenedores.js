// pages/api/export-contenedores.js
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
    console.log('🚢 Exportando base de datos de contenedores...');

    // Obtener todos los contenedores
    const { data: contenedores, error } = await supabase
      .from('containers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error obteniendo contenedores:', error);
      throw error;
    }

    console.log(`✅ Total contenedores obtenidos: ${contenedores?.length || 0}`);

    // Preparar datos para Excel
    const excelData = (contenedores || []).map(c => ({
      'ID': c.id,
      'Container Number': c.container_number || '',
      'Container Type': c.container_type || '',
      'Max CBM': c.max_cbm || 0,
      'Departure Port': c.departure_port || '',
      'Arrival Port': c.arrival_port || '',
      'Estimated Departure': c.estimated_departure || '',
      'Estimated Arrival': c.estimated_arrival || '',
      'Actual Departure': c.actual_departure || '',
      'Actual Arrival Date': c.actual_arrival_date || '',
      'Shipping Company': c.shipping_company || '',
      'Status': c.status || '',
      'Notes': c.notes || '',
      'Created At': c.created_at || '',
      'Updated At': c.updated_at || ''
    }));

    // Crear libro de Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Auto-ajustar anchos de columnas
    const colWidths = [
      { wch: 10 }, // ID
      { wch: 20 }, // Container Number
      { wch: 15 }, // Container Type
      { wch: 10 }, // Max CBM
      { wch: 20 }, // Departure Port
      { wch: 20 }, // Arrival Port
      { wch: 18 }, // Estimated Departure
      { wch: 18 }, // Estimated Arrival
      { wch: 18 }, // Actual Departure
      { wch: 18 }, // Actual Arrival Date
      { wch: 25 }, // Shipping Company
      { wch: 15 }, // Status
      { wch: 40 }, // Notes
      { wch: 20 }, // Created At
      { wch: 20 }  // Updated At
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
