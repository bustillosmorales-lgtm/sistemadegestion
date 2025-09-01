// lib/database.js
export let config = {
    tiempoEntrega: 90,
    stockSaludableMinDias: 90,
    stockSaludableMaxDias: 120,
    rmbToUsd: 0.14,
    usdToClp: 980,
    costosFijosUSD: {
        envioOtraBodega: 1400, fleteMaritimo: 3000, thcd: 150, bl: 60,
        gateInComodato: 420, aperturaManifiesto: 55, honorarios: 578,
    },
    costosFijosCLP: {
        comisionBancaria: 578000, peonetas: 120000, gastosDespacho: 45000,
        movilizacionNacional: 330000, movilizacionPuerto: 35700, aforo: 1500000,
    },
    costosVariablesPct: {
        comisionChina: 0.03, seguroContenedor: 0.02,
        derechosAdValorem: 0.00, iva: 0.19,
    },
    mercadoLibre: {
        comisionPct: 0.16, envioUmbral: 19990, costoEnvio: 3500,
        cargoFijoMedioUmbral: 9990, cargoFijoMedio: 1000, cargoFijoBajo: 700,
    },
    containerCBM: 68
};

export let database = {
  products: [
    {
      sku: '649701',
      descripcion: 'Producto A - Ejemplo',
      stockActual: 270,
      costoFOB_RMB: 35.5,
      cbm: 0.05,
      ventaDiaria: 3,
      link: 'https://example.com/producto-a',
      status: 'NEEDS_REPLENISHMENT',
      requestDetails: null, quoteDetails: null, analysisDetails: null, approvalDetails: null,
      purchaseDetails: null, manufacturingDetails: null, shippingDetails: null,
    },
    {
      sku: '649702',
      descripcion: 'Producto B - Ejemplo',
      stockActual: 800,
      costoFOB_RMB: 75,
      cbm: 0.01,
      ventaDiaria: 5.0,
      link: 'https://example.com/producto-b',
      status: 'QUOTED',
      requestDetails: { quantityToQuote: '1000', comments: 'Cotización inicial.' },
      quoteDetails: { unitPrice: '10.50', currency: 'USD', unitsPerBox: '10', cbmPerBox: '0.1', productionDays: '30', comments: 'Precio válido por 15 días.' },
      analysisDetails: null, approvalDetails: null, purchaseDetails: null,
      manufacturingDetails: null, shippingDetails: null,
    }
  ],
  transit: [
      { sku: '649701', cantidad: 90, fechaLlegada: '2025-10-15' }
  ],
  users: [
    { id: 'user1', name: 'Usuario 1 (Chile)', role: 'chile', email: 'usuario1@example.com' },
    { id: 'user2', name: 'Usuario 2 (China)', role: 'china', email: 'usuario2@example.com' },
    { id: 'user3', name: 'Usuario 3 (Admin)', role: 'admin', email: 'admin@example.com' },
  ]
};
