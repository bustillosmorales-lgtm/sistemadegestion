// pages/api/status.js
import { database, config } from '../../lib/database';

const workflowOrder = [
    'NEEDS_REPLENISHMENT', 'QUOTE_REQUESTED', 'QUOTED', 'ANALYZING',
    'PURCHASE_APPROVED', 'PURCHASE_CONFIRMED', 'MANUFACTURED', 'SHIPPED',
    'QUOTE_REJECTED'
];

export default function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const { sku, nextStatus, payload } = req.body;
    if (!sku || !nextStatus) {
        return res.status(400).json({ error: 'Faltan los parámetros SKU y nextStatus.' });
    }

    const product = database.products.find(p => p.sku === sku);
    if (!product) {
        return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    const currentIndex = workflowOrder.indexOf(product.status);
    const nextIndex = workflowOrder.indexOf(nextStatus);
    
    const isValidTransition = (nextIndex === currentIndex + 1) || (nextStatus === 'QUOTE_REJECTED' && product.status === 'ANALYZING');

    if (isValidTransition) {
        switch (product.status) {
            case 'NEEDS_REPLENISHMENT':
                product.requestDetails = payload;
                break;
            case 'QUOTE_REQUESTED':
                product.quoteDetails = payload;
                if(payload.unitPrice && payload.currency) {
                    const price = parseFloat(payload.unitPrice);
                    let unitPriceUSD = 0;
                    if (payload.currency === 'RMB') {
                        unitPriceUSD = price * config.rmbToUsd;
                    } else { // Asume USD
                        unitPriceUSD = price;
                    }
                    // Siempre guardamos el costoFOB en RMB para consistencia
                    product.costoFOB_RMB = unitPriceUSD / config.rmbToUsd;
                }
                if(payload.cbmPerBox && payload.unitsPerBox) {
                    product.cbm = parseFloat(payload.cbmPerBox) / parseFloat(payload.unitsPerBox);
                }
                break;
            case 'QUOTED':
                product.analysisDetails = payload;
                break;
            case 'ANALYZING':
                product.approvalDetails = payload;
                break;
            case 'PURCHASE_APPROVED':
                product.purchaseDetails = payload;
                break;
            case 'PURCHASE_CONFIRMED':
                product.manufacturingDetails = payload;
                break;
            case 'MANUFACTURED':
                product.shippingDetails = payload;
                break;
        }

        product.status = nextStatus;
        return res.status(200).json({ message: `Estado del SKU ${sku} actualizado a ${nextStatus}` });
    } else {
        return res.status(400).json({ 
            error: 'Transición de estado no válida.',
            current: product.status,
            requested: nextStatus
        });
    }
}
