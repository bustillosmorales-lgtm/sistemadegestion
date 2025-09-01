import { database } from '../../../lib/database';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const quoteData = req.body;

      console.log('--- Nueva Cotización Recibida ---');
      console.log('SKU:', quoteData.sku);
      console.log('Precio FOB (RMB):', quoteData.precio_rmb);
      console.log('CBM por Embalaje:', quoteData.cbm_embalaje);
      console.log('Unidades por Embalaje:', quoteData.unidades_embalaje);
      console.log('---------------------------------');

      // Actualizar el status del producto a QUOTED
      const statusResponse = await fetch(`${req.headers.origin || 'http://localhost:3000'}/api/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: quoteData.sku,
          nextStatus: 'QUOTED',
          payload: {
            unitPrice: quoteData.precio_rmb,
            currency: 'RMB',
            cbmPerBox: quoteData.cbm_embalaje,
            unitsPerBox: quoteData.unidades_embalaje,
            supplierCity: quoteData.ciudad_proveedor,
            quotedDate: new Date().toISOString()
          }
        })
      });

      if (!statusResponse.ok) {
        const errorData = await statusResponse.json();
        throw new Error(errorData.error || 'Error al actualizar el status');
      }

      res.status(200).json({ 
        message: `Cotización para el SKU ${quoteData.sku} guardada y status actualizado a QUOTED.` 
      });

    } catch (error) {
      console.error('Error en quote/submit:', error);
      res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end('Method Not Allowed');
  }
}
