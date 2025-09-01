// pages/api/load-test-data.js
// API para cargar datos de prueba usando las credenciales existentes
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Solo método POST permitido' });
  }

  try {
    // 1. PRODUCTOS DE PRUEBA
    const products = [
      { sku: 'TEST-001', descripcion: 'Auriculares Bluetooth Premium', stock_actual: 45, costo_fob_rmb: 25.50, cbm: 0.02, link: 'https://example.com/auriculares', status: 'NEEDS_REPLENISHMENT' },
      { sku: 'TEST-002', descripcion: 'Mouse Gaming RGB', stock_actual: 120, costo_fob_rmb: 18.75, cbm: 0.015, link: 'https://example.com/mouse', status: 'QUOTED' },
      { sku: 'TEST-003', descripcion: 'Teclado Mecánico', stock_actual: 0, costo_fob_rmb: 45.00, cbm: 0.08, link: 'https://example.com/teclado', status: 'ANALYZING' },
      { sku: 'TEST-004', descripcion: 'Webcam 4K', stock_actual: 85, costo_fob_rmb: 32.25, cbm: 0.025, link: 'https://example.com/webcam', status: 'PURCHASE_APPROVED' },
      { sku: 'TEST-005', descripcion: 'Cargador Inalámbrico', stock_actual: 200, costo_fob_rmb: 12.50, cbm: 0.01, link: 'https://example.com/cargador', status: 'SHIPPED' }
    ];

    console.log('Insertando productos...');
    const { data: insertedProducts, error: productsError } = await supabase
      .from('products')
      .insert(products)
      .select();

    if (productsError) {
      console.error('Error insertando productos:', productsError);
      return res.status(500).json({ error: 'Error insertando productos: ' + productsError.message });
    }

    // 2. COMPRAS DE PRUEBA
    const compras = [
      { sku: 'TEST-001', cantidad: 100, fecha_compra: '2025-07-15T10:00:00Z', fecha_llegada_estimada: '2025-08-15T00:00:00Z', fecha_llegada_real: '2025-08-10T14:30:00Z', status_compra: 'llegado' },
      { sku: 'TEST-002', cantidad: 200, fecha_compra: '2025-06-20T09:00:00Z', fecha_llegada_estimada: '2025-07-20T00:00:00Z', fecha_llegada_real: '2025-07-18T16:45:00Z', status_compra: 'llegado' },
      { sku: 'TEST-003', cantidad: 150, fecha_compra: '2025-05-10T11:30:00Z', fecha_llegada_estimada: '2025-06-10T00:00:00Z', fecha_llegada_real: '2025-06-08T09:15:00Z', status_compra: 'llegado' }
    ];

    console.log('Insertando compras...');
    const { data: insertedCompras, error: comprasError } = await supabase
      .from('compras')
      .insert(compras)
      .select();

    if (comprasError) {
      console.error('Error insertando compras:', comprasError);
      return res.status(500).json({ error: 'Error insertando compras: ' + comprasError.message });
    }

    // 3. VENTAS DE PRUEBA (algunas ventas para cada producto)
    const ventas = [
      // TEST-001 - Ventas desde 11-ago
      { sku: 'TEST-001', cantidad: 2, fecha_venta: '2025-08-11T10:30:00Z' },
      { sku: 'TEST-001', cantidad: 3, fecha_venta: '2025-08-12T14:15:00Z' },
      { sku: 'TEST-001', cantidad: 1, fecha_venta: '2025-08-13T09:45:00Z' },
      { sku: 'TEST-001', cantidad: 2, fecha_venta: '2025-08-14T16:20:00Z' },
      { sku: 'TEST-001', cantidad: 4, fecha_venta: '2025-08-15T11:10:00Z' },
      { sku: 'TEST-001', cantidad: 2, fecha_venta: '2025-08-16T13:30:00Z' },
      { sku: 'TEST-001', cantidad: 3, fecha_venta: '2025-08-17T08:45:00Z' },
      { sku: 'TEST-001', cantidad: 1, fecha_venta: '2025-08-18T15:20:00Z' },
      { sku: 'TEST-001', cantidad: 2, fecha_venta: '2025-08-19T10:15:00Z' },
      { sku: 'TEST-001', cantidad: 3, fecha_venta: '2025-08-20T14:40:00Z' },

      // TEST-002 - Alta demanda desde 19-jul
      { sku: 'TEST-002', cantidad: 5, fecha_venta: '2025-07-19T09:00:00Z' },
      { sku: 'TEST-002', cantidad: 7, fecha_venta: '2025-07-20T11:30:00Z' },
      { sku: 'TEST-002', cantidad: 4, fecha_venta: '2025-07-21T14:15:00Z' },
      { sku: 'TEST-002', cantidad: 6, fecha_venta: '2025-07-22T08:45:00Z' },
      { sku: 'TEST-002', cantidad: 8, fecha_venta: '2025-07-23T16:20:00Z' },
      { sku: 'TEST-002', cantidad: 5, fecha_venta: '2025-07-24T10:30:00Z' },
      { sku: 'TEST-002', cantidad: 6, fecha_venta: '2025-07-25T13:45:00Z' },
      { sku: 'TEST-002', cantidad: 4, fecha_venta: '2025-07-26T09:15:00Z' },
      { sku: 'TEST-002', cantidad: 7, fecha_venta: '2025-07-27T15:30:00Z' },
      { sku: 'TEST-002', cantidad: 5, fecha_venta: '2025-07-28T11:45:00Z' },

      // TEST-003 - Producto agotado, ventas hasta que se agotó
      { sku: 'TEST-003', cantidad: 8, fecha_venta: '2025-06-09T10:00:00Z' },
      { sku: 'TEST-003', cantidad: 10, fecha_venta: '2025-06-10T14:30:00Z' },
      { sku: 'TEST-003', cantidad: 6, fecha_venta: '2025-06-11T09:15:00Z' },
      { sku: 'TEST-003', cantidad: 12, fecha_venta: '2025-06-12T16:45:00Z' },
      { sku: 'TEST-003', cantidad: 9, fecha_venta: '2025-06-13T11:20:00Z' },
      { sku: 'TEST-003', cantidad: 7, fecha_venta: '2025-06-14T13:50:00Z' },
      { sku: 'TEST-003', cantidad: 11, fecha_venta: '2025-06-15T08:30:00Z' },
      { sku: 'TEST-003', cantidad: 8, fecha_venta: '2025-06-16T15:15:00Z' },
      { sku: 'TEST-003', cantidad: 10, fecha_venta: '2025-06-17T10:45:00Z' },
      { sku: 'TEST-003', cantidad: 6, fecha_venta: '2025-06-18T14:20:00Z' },
      { sku: 'TEST-003', cantidad: 9, fecha_venta: '2025-06-19T09:35:00Z' },
      { sku: 'TEST-003', cantidad: 12, fecha_venta: '2025-06-20T16:10:00Z' },
      { sku: 'TEST-003', cantidad: 7, fecha_venta: '2025-06-21T11:55:00Z' },
      { sku: 'TEST-003', cantidad: 8, fecha_venta: '2025-06-22T13:25:00Z' },
      { sku: 'TEST-003', cantidad: 11, fecha_venta: '2025-06-23T08:40:00Z' },
      { sku: 'TEST-003', cantidad: 10, fecha_venta: '2025-06-24T15:30:00Z' },
      { sku: 'TEST-003', cantidad: 6, fecha_venta: '2025-06-25T10:15:00Z' },
      { sku: 'TEST-003', cantidad: 9, fecha_venta: '2025-06-26T14:50:00Z' }
    ];

    console.log('Insertando ventas...');
    const { data: insertedVentas, error: ventasError } = await supabase
      .from('ventas')
      .insert(ventas)
      .select();

    if (ventasError) {
      console.error('Error insertando ventas:', ventasError);
      return res.status(500).json({ error: 'Error insertando ventas: ' + ventasError.message });
    }

    return res.status(200).json({
      message: 'Datos de prueba cargados exitosamente',
      summary: {
        productos: insertedProducts?.length || 0,
        compras: insertedCompras?.length || 0,
        ventas: insertedVentas?.length || 0
      }
    });

  } catch (error) {
    console.error('Error general:', error);
    return res.status(500).json({ error: 'Error interno: ' + error.message });
  }
}