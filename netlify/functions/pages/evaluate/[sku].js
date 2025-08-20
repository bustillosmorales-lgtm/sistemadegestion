import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = url => fetch(url).then(res => res.json());

export default function EvaluateSkuPage() {
  const router = useRouter();
  const { sku } = router.query;
  const [precioVenta, setPrecioVenta] = useState('29990');
  const [debouncedPrecio, setDebouncedPrecio] = useState('29990');
  
  // Debounce para precio de venta
  useEffect(() => {
    const handler = setTimeout(() => {
      if (precioVenta) {
        setDebouncedPrecio(precioVenta);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [precioVenta]);
  
  const apiUrl = sku ? `/api/analysis?sku=${sku}&precioVenta=${debouncedPrecio || '29990'}` : null;
  const { data, error } = useSWR(apiUrl, fetcher);
  
  if (error) return <div className='p-8 text-red-500'>Error al cargar datos: {error.message}</div>;
  if (!data) return <div className='p-8'>Cargando...</div>;
  if (!data.results || data.results.length === 0) return <div className='p-8'>Producto no encontrado</div>;
  
  const product = data.results[0];
  const margen = parseFloat(product.margen);
  
  return (
    <div className='p-8 bg-gray-100 min-h-screen'>
      <button 
        onClick={() => router.push('/dashboard')} 
        className='text-blue-600 hover:underline mb-6 flex items-center gap-2'
      >
        ← Volver al Dashboard
      </button>
      
      <div className='bg-white p-6 rounded-lg shadow-md max-w-6xl'>
        <h1 className='text-3xl font-bold text-gray-800'>{product.descripcion}</h1>
        <p className='text-sm text-gray-500 mb-6'>SKU: {product.sku}</p>
        
        <div className='grid md:grid-cols-3 gap-6'>
          <div>
            <h3 className='font-semibold mb-4 text-lg'>Informacion del Producto</h3>
            <div className='space-y-2 text-sm bg-gray-50 p-4 rounded'>
              <p><span className='font-medium'>Stock Actual:</span> {product.stockActual} unidades</p>
              <p><span className='font-medium'>En Transito:</span> {product.enTransito} unidades</p>
              <p><span className='font-medium'>Venta Diaria:</span> {product.ventaDiaria} unidades/dia</p>
              <p><span className='font-medium'>Dias de Cobertura:</span> {Math.round(product.stockActual / product.ventaDiaria)} dias</p>
              <p><span className='font-medium'>Estado:</span> 
                <span className={`ml-2 px-2 py-1 rounded text-xs font-bold ${
                  product.estadoInventario === 'CRITICO' ? 'bg-red-500 text-white' :
                  product.estadoInventario === 'ALTO' ? 'bg-yellow-500 text-white' :
                  product.estadoInventario === 'MEDIO' ? 'bg-blue-500 text-white' :
                  product.estadoInventario === 'SALUDABLE' ? 'bg-green-500 text-white' :
                  'bg-purple-500 text-white'
                }`}>
                  {product.estadoInventario}
                </span>
              </p>
              <p><span className='font-medium'>Cantidad Sugerida:</span> {product.cantidadSugerida} unidades</p>
            </div>
          </div>
          
          <div>
            <h3 className='font-semibold mb-4 text-lg'>Costos Base</h3>
            <div className='space-y-2 text-sm bg-gray-50 p-4 rounded'>
              <p><span className='font-medium'>Costo FOB (RMB):</span> ¥{product.costoFOB_RMB}</p>
              <p><span className='font-medium'>CBM:</span> {product.cbm} m³</p>
              <p><span className='font-medium'>Costo Final Bodega:</span> ${new Intl.NumberFormat('es-CL').format(product.costoFinalBodega)}</p>
              <p><span className='font-medium'>Comision MercadoLibre:</span> {(product.comisionMeliPct * 100).toFixed(1)}%</p>
            </div>
          </div>
          
          <div className='p-4 border rounded-lg bg-blue-50'>
            <h3 className='font-semibold mb-4 text-lg'>Calculadora de Rentabilidad</h3>
            
            <div className='mb-4'>
              <label className='block text-sm font-medium mb-2'>Precio de Venta (CLP)</label>
              <input 
                type='number' 
                value={precioVenta}
                onChange={(e) => setPrecioVenta(e.target.value)}
                className='w-full border rounded p-2 text-lg font-bold'
                min='0'
              />
            </div>
            
            <div className='space-y-3 text-sm'>
              <div className='flex justify-between'>
                <span>Precio de Venta:</span>
                <span className='font-bold'>${new Intl.NumberFormat('es-CL').format(debouncedPrecio)}</span>
              </div>
              <div className='flex justify-between'>
                <span>Costo Bodega:</span>
                <span className='font-bold'>-${new Intl.NumberFormat('es-CL').format(product.costoFinalBodega)}</span>
              </div>
              <hr />
              <div className='flex justify-between text-lg'>
                <span className='font-bold'>Margen:</span>
                <span className={`font-bold text-xl ${
                  margen > 25 ? 'text-green-600' : 
                  margen > 15 ? 'text-yellow-600' : 
                  margen > 0 ? 'text-orange-600' : 'text-red-600'
                }`}>
                  {margen.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className='mt-8 flex justify-end gap-4'>
          <button 
            onClick={() => alert('Producto rechazado')}
            className='bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600 transition-colors'
          >
            Rechazar
          </button>
          <button 
            onClick={() => alert('Producto aprobado para venta')}
            className='bg-green-600 text-white px-6 py-2 rounded font-bold hover:bg-green-700 transition-colors'
          >
            Aprobar
          </button>
        </div>
      </div>
    </div>
  );
}