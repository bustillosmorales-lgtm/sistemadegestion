import { useRouter } from 'next/router';
import useSWR from 'swr';
import { useState, useEffect } from 'react';

const fetcher = url => fetch(url).then(res => res.json());

export default function EvaluateSkuPage() {
  const router = useRouter();
  const { sku } = router.query;
  
  const [precioVenta, setPrecioVenta] = useState('29990');
  const [debouncedPrecio, setDebouncedPrecio] = useState('29990');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedPrecio(precioVenta || '29990');
    }, 500);
    return () => clearTimeout(handler);
  }, [precioVenta]);

  const apiUrl = sku ? `/api/analysis?sku=${sku}&precioVenta=${debouncedPrecio}` : null;
  const { data, error } = useSWR(apiUrl, fetcher);

  if (error) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50'>
        <div className='text-center'>
          <div className='text-6xl mb-4'>❌</div>
          <h1 className='text-2xl font-bold text-red-600 mb-4'>Error al cargar el producto</h1>
          <button onClick={() => router.push('/dashboard')} className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'>
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50'>
        <div className='text-center'>
          <div className='animate-spin text-6xl mb-4'>⚙️</div>
          <div className='text-xl font-semibold text-gray-600'>Cargando análisis...</div>
        </div>
      </div>
    );
  }

  const product = data.results[0];
  const margen = parseFloat(product.margen);
  const formatCLP = (value) => new Intl.NumberFormat('es-CL').format(value);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className='bg-white shadow-sm border-b'>
        <div className='max-w-6xl mx-auto px-4 py-4'>
          <button 
            onClick={() => router.push('/dashboard')} 
            className='text-blue-600 hover:text-blue-800 flex items-center font-medium'
          >
            ← Volver al Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">{product.descripcion}</h1>
            <p className="text-lg text-gray-500">SKU: {product.sku}</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-xl font-semibold mb-4 border-b pb-2">💰 Desglose de Costos</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Precio de Venta:</span> 
                    <span className="font-bold text-xl text-green-600">${formatCLP(debouncedPrecio || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-red-600">
                    <span>- Costo en Bodega:</span> 
                    <span className="font-semibold">${formatCLP(product.costoFinalBodega)}</span>
                  </div>
                  <div className="flex justify-between items-center text-red-600">
                    <span>- Costos de Venta (ML):</span> 
                    <span className="font-semibold">${formatCLP(product.costosVenta)}</span>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-lg">= Ganancia Neta:</span> 
                      <span className={`font-bold text-2xl ${product.gananciaNeta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${formatCLP(product.gananciaNeta)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-6 rounded-lg">
                <h3 className="text-xl font-semibold mb-4">📊 Información de Inventario</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{product.stockActual}</div>
                    <div className="text-sm text-gray-600">Stock Actual</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{product.enTransito}</div>
                    <div className="text-sm text-gray-600">En Tránsito</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{product.ventaDiaria}</div>
                    <div className="text-sm text-gray-600">Venta Diaria</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{product.cantidadSugerida}</div>
                    <div className="text-sm text-gray-600">Sugerida</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className={`p-8 rounded-lg text-white text-center ${margen > 15 ? 'bg-gradient-to-r from-green-500 to-green-600' : margen > 10 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' : 'bg-gradient-to-r from-red-500 to-red-600'}`}>
                <h3 className="text-xl font-semibold mb-4">🎯 Calculadora de Rentabilidad</h3>
                <div className="text-5xl font-bold mb-2">{margen.toFixed(2)}%</div>
                <div className="text-lg opacity-90">Margen de Ganancia</div>
              </div>

              <div className="bg-white border-2 border-blue-200 p-6 rounded-lg">
                <label htmlFor="precioVenta" className="block text-lg font-semibold text-gray-700 mb-3">
                  💵 Precio de Venta Estimado (CLP)
                </label>
                <input
                  type="number"
                  id="precioVenta"
                  value={precioVenta}
                  onChange={(e) => setPrecioVenta(e.target.value)}
                  className="w-full px-4 py-3 text-xl border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-bold"
                  placeholder="29990"
                />
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {[15000, 25000, 35000, 45000].map(price => (
                    <button
                      key={price}
                      onClick={() => setPrecioVenta(price.toString())}
                      className="px-3 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-all font-semibold"
                    >
                      ${price.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-green-50 p-6 rounded-lg">
                <h4 className="font-semibold mb-3 text-green-800">🎯 Recomendaciones</h4>
                <div className="space-y-2 text-sm">
                  {margen < 10 ? (
                    <div className="flex items-center text-red-700">
                      <span className="mr-2">🚨</span>
                      <span>Margen muy bajo. Considere aumentar el precio.</span>
                    </div>
                  ) : margen < 20 ? (
                    <div className="flex items-center text-yellow-700">
                      <span className="mr-2">⚡</span>
                      <span>Margen aceptable pero puede mejorarse.</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-green-700">
                      <span className="mr-2">✅</span>
                      <span>Excelente margen de ganancia.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <button 
              onClick={async () => {
                try {
                  const response = await fetch('/api/status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      sku: sku,
                      nextStatus: 'PURCHASE_APPROVED',
                      payload: {
                        precioVentaAprobado: debouncedPrecio,
                        margenAprobado: margen,
                        gananciaNeta: product.gananciaNeta,
                        fechaAprobacion: new Date().toISOString()
                      }
                    })
                  });
                  
                  const result = await response.json();
                  if (response.ok) {
                    alert('¡Compra aprobada exitosamente!');
                    router.push('/dashboard');
                  } else {
                    alert('Error: ' + result.error);
                  }
                } catch (error) {
                  alert('Error al aprobar la compra: ' + error.message);
                }
              }}
              className="bg-gradient-to-r from-green-600 to-green-700 text-white px-8 py-3 rounded-lg font-bold text-lg hover:from-green-700 hover:to-green-800 transition-all"
            >
              ✅ Aprobar Compra
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}