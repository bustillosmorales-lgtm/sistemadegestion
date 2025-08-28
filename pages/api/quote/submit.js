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

      res.status(200).json({ 
        message: `Cotización para el SKU ${quoteData.sku} fue recibida por el servidor.` 
      });

    } catch (error) {
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end('Method Not Allowed');
  }
}
