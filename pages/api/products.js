// pages/api/products.js
import { database } from '../../lib/database';

export default function handler(req, res) {
  // OBTENER PRODUCTO(S)
  if (req.method === 'GET') {
    const { sku } = req.query;
    if (sku) {
        const product = database.products.find(p => p.sku === sku);
        if (product) {
            return res.status(200).json(product);
        }
        return res.status(404).json({ error: 'Producto no encontrado' });
    }
    return res.status(200).json(database.products);
  }

  // CREAR PRODUCTO NUEVO
  if (req.method === 'POST') {
    const { descripcion, cantidad, link, costoFOB_RMB, cbm, ventaDiaria } = req.body;

    // Validación de backend
    if (!descripcion || costoFOB_RMB === undefined || cbm === undefined || ventaDiaria === undefined) {
        return res.status(400).json({ error: 'Faltan campos requeridos: descripción, costo FOB, CBM y Venta Diaria.' });
    }
    if (isNaN(parseFloat(costoFOB_RMB)) || isNaN(parseFloat(cbm)) || isNaN(parseFloat(ventaDiaria))) {
        return res.status(400).json({ error: 'Costo FOB, CBM y Venta Diaria deben ser números.' });
    }

    // LÍNEA CORREGIDA: Se arregló la generación del SKU
    const newSku = `SKU-${Math.floor(100000 + Math.random() * 900000)}`;
    const newProduct = {
        sku: newSku,
        descripcion,
        stockActual: parseInt(cantidad) || 0,
        link: link || '',
        costoFOB_RMB: parseFloat(costoFOB_RMB),
        cbm: parseFloat(cbm),
        ventaDiaria: parseFloat(ventaDiaria),
    };
    database.products.unshift(newProduct);
    return res.status(201).json(newProduct);
  }

  // EDITAR PRODUCTO
  if (req.method === 'PUT') {
    const { sku, descripcion, costoFOB_RMB, cbm, ventaDiaria, stockActual } = req.body;
     
    if (!sku) return res.status(400).json({ error: 'El SKU es requerido para actualizar.' });

    const productIndex = database.products.findIndex(p => p.sku === sku);
    if (productIndex === -1) {
        return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    // Validación de backend
    const product = database.products[productIndex];
    product.descripcion = descripcion || product.descripcion;
    product.costoFOB_RMB = !isNaN(parseFloat(costoFOB_RMB)) ? parseFloat(costoFOB_RMB) : product.costoFOB_RMB;
    product.cbm = !isNaN(parseFloat(cbm)) ? parseFloat(cbm) : product.cbm;
    product.ventaDiaria = !isNaN(parseFloat(ventaDiaria)) ? parseFloat(ventaDiaria) : product.ventaDiaria;
    product.stockActual = !isNaN(parseInt(stockActual)) ? parseInt(stockActual) : product.stockActual;

    return res.status(200).json(product);
  }

  res.setHeader('Allow', ['GET', 'POST', 'PUT']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
