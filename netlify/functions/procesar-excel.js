/**
 * Netlify Function: Procesar Excel y cargar a Supabase
 * POST /api/procesar-excel
 */

const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { filePath } = JSON.parse(event.body);

    if (!filePath) {
      throw new Error('filePath requerido');
    }

    // 1. Descargar archivo de Supabase Storage
    console.log('Descargando archivo:', filePath);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('excel-uploads')
      .download(filePath);

    if (downloadError) {
      throw new Error(`Error descargando: ${downloadError.message}`);
    }

    // 2. Leer Excel
    console.log('Leyendo Excel...');
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const resultados = {
      ventas_cargadas: 0,
      stock_cargado: 0,
      transito_cargado: 0,
      compras_cargadas: 0,
      packs_cargados: 0,
      desconsiderar_cargados: 0
    };

    // 3. Procesar hoja "ventas"
    if (workbook.SheetNames.includes('ventas')) {
      console.log('Procesando ventas...');
      const ventasSheet = workbook.Sheets['ventas'];
      const ventasData = XLSX.utils.sheet_to_json(ventasSheet, { header: 1 });

      const ventasRegistros = [];

      // Saltar header (fila 0)
      for (let i = 1; i < ventasData.length; i++) {
        const row = ventasData[i];

        const empresa = row[0]?.toString().trim();
        const canal = row[1]?.toString().trim();

        // Solo TLT + MELI
        if (empresa?.toUpperCase() !== 'TLT' || canal?.toUpperCase() !== 'MELI') {
          continue;
        }

        const sku = row[19]?.toString().trim(); // Columna T (índice 19)
        const unidades = parseFloat(row[10]) || 0; // Columna K (índice 10)

        if (!sku || unidades <= 0) continue;

        ventasRegistros.push({
          empresa,
          canal,
          fecha: excelDateToJSDate(row[5]), // Columna F (índice 5)
          unidades,
          sku,
          mlc: row[20]?.toString().trim() || '', // Columna U
          descripcion: row[21]?.toString().trim() || '', // Columna V
          precio: parseFloat(row[23]) || 0 // Columna X
        });
      }

      // Insertar en lotes de 100
      if (ventasRegistros.length > 0) {
        for (let i = 0; i < ventasRegistros.length; i += 100) {
          const batch = ventasRegistros.slice(i, i + 100);
          await supabase.from('ventas_historicas').insert(batch);
          resultados.ventas_cargadas += batch.length;
        }
      }
    }

    // 4. Procesar hoja "Stock"
    if (workbook.SheetNames.includes('Stock')) {
      console.log('Procesando stock...');
      const stockSheet = workbook.Sheets['Stock'];
      const stockData = XLSX.utils.sheet_to_json(stockSheet, { header: 1 });

      const stockRegistros = [];

      for (let i = 1; i < stockData.length; i++) {
        const row = stockData[i];
        const sku = row[0]?.toString().trim();

        if (!sku) continue;

        stockRegistros.push({
          sku,
          descripcion: row[1]?.toString().trim() || '',
          bodega_c: parseFloat(row[2]) || 0,
          bodega_d: parseFloat(row[3]) || 0,
          bodega_e: parseFloat(row[4]) || 0,
          bodega_f: parseFloat(row[5]) || 0,
          bodega_h: parseFloat(row[7]) || 0,
          bodega_j: parseFloat(row[9]) || 0
        });
      }

      if (stockRegistros.length > 0) {
        for (let i = 0; i < stockRegistros.length; i += 100) {
          const batch = stockRegistros.slice(i, i + 100);
          await supabase.from('stock_actual').upsert(batch);
          resultados.stock_cargado += batch.length;
        }
      }
    }

    // 5. Procesar "transito china"
    if (workbook.SheetNames.includes('transito china')) {
      console.log('Procesando tránsito china...');
      const transitoSheet = workbook.Sheets['transito china'];
      const transitoData = XLSX.utils.sheet_to_json(transitoSheet, { header: 1 });

      const transitoRegistros = [];

      for (let i = 1; i < transitoData.length; i++) {
        const row = transitoData[i];
        const sku = row[3]?.toString().trim(); // Columna D
        const unidades = parseFloat(row[7]) || 0; // Columna H

        if (!sku || unidades <= 0) continue;

        transitoRegistros.push({
          sku,
          unidades,
          estado: 'en_transito'
        });
      }

      if (transitoRegistros.length > 0) {
        await supabase.from('transito_china').insert(transitoRegistros);
        resultados.transito_cargado = transitoRegistros.length;
      }
    }

    // 6. Procesar "compras"
    if (workbook.SheetNames.includes('compras')) {
      console.log('Procesando compras...');
      const comprasSheet = workbook.Sheets['compras'];
      const comprasData = XLSX.utils.sheet_to_json(comprasSheet, { header: 1 });

      const comprasRegistros = [];

      for (let i = 1; i < comprasData.length; i++) {
        const row = comprasData[i];
        const sku = row[0]?.toString().trim();
        const fecha = excelDateToJSDate(row[3]); // Columna D

        if (!sku || !fecha) continue;

        comprasRegistros.push({
          sku,
          fecha_compra: fecha
        });
      }

      if (comprasRegistros.length > 0) {
        for (let i = 0; i < comprasRegistros.length; i += 100) {
          const batch = comprasRegistros.slice(i, i + 100);
          await supabase.from('compras_historicas').insert(batch);
          resultados.compras_cargadas += batch.length;
        }
      }
    }

    // 7. Procesar "Packs"
    if (workbook.SheetNames.includes('Packs')) {
      console.log('Procesando packs...');
      const packsSheet = workbook.Sheets['Packs'];
      const packsData = XLSX.utils.sheet_to_json(packsSheet, { header: 1 });

      const packsRegistros = [];

      for (let i = 1; i < packsData.length; i++) {
        const row = packsData[i];
        const sku_pack = row[0]?.toString().trim();
        const sku_componente = row[1]?.toString().trim();
        const cantidad = parseFloat(row[2]) || 1;

        if (!sku_pack || !sku_componente) continue;

        packsRegistros.push({
          sku_pack,
          sku_componente,
          cantidad
        });
      }

      if (packsRegistros.length > 0) {
        await supabase.from('packs').insert(packsRegistros);
        resultados.packs_cargados = packsRegistros.length;
      }
    }

    // 8. Procesar "desconsiderar" (opcional)
    if (workbook.SheetNames.includes('desconsiderar')) {
      console.log('Procesando desconsiderar...');
      const descSheet = workbook.Sheets['desconsiderar'];
      const descData = XLSX.utils.sheet_to_json(descSheet, { header: 1 });

      const descRegistros = [];

      for (let i = 1; i < descData.length; i++) {
        const row = descData[i];
        const sku = row[0]?.toString().trim();

        if (!sku) continue;

        descRegistros.push({ sku });
      }

      if (descRegistros.length > 0) {
        await supabase.from('skus_desconsiderar').insert(descRegistros);
        resultados.desconsiderar_cargados = descRegistros.length;
      }
    }

    // 9. Eliminar archivo temporal de storage
    await supabase.storage.from('excel-uploads').remove([filePath]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        ...resultados
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

// Helper: Convertir fecha de Excel a JS Date
function excelDateToJSDate(excelDate) {
  if (!excelDate) return null;

  // Si ya es string de fecha
  if (typeof excelDate === 'string') {
    const date = new Date(excelDate);
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  }

  // Si es número de Excel (días desde 1900-01-01)
  if (typeof excelDate === 'number') {
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }

  return null;
}
