import { useRouter } from 'next/router';

export default function ProductTable({ products }) {
  const router = useRouter();
  
  if (!products || products.length === 0) { 
    return <p>No hay productos para mostrar.</p>; 
  }
  
  return (
    <div className='overflow-x-auto bg-white rounded shadow'>
      <table className='min-w-full text-sm'>
        <thead className='bg-gray-100'>
          <tr>
            <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>SKU</th>
            <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Descripcion</th>
            <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Stock Actual</th>
            <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>En Transito</th>
            <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Venta Diaria</th>
            <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Estado</th>
            <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Cant. Sugerida</th>
            <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Margen</th>
            <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Accion</th>
          </tr>
        </thead>
        <tbody className='bg-white divide-y divide-gray-200'>
          {products.map((product) => (
            <tr key={product.sku} className='hover:bg-gray-50'>
              <td className='px-4 py-4 whitespace-nowrap font-medium text-gray-900'>{product.sku}</td>
              <td className='px-4 py-4 whitespace-nowrap text-gray-500'>{product.descripcion}</td>
              <td className='px-4 py-4 whitespace-nowrap text-gray-500'>
                <div>
                  <div className='font-medium'>{product.stockActual}</div>
                  <div className='text-xs text-gray-400'>{Math.round(product.stockActual / product.ventaDiaria)} dias</div>
                </div>
              </td>
              <td className='px-4 py-4 whitespace-nowrap text-gray-500'>{product.enTransito}</td>
              <td className='px-4 py-4 whitespace-nowrap text-gray-500'>{product.ventaDiaria.toFixed(2)}</td>
              <td className='px-4 py-4 whitespace-nowrap'>
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  product.estadoInventario === 'CRITICO' ? 'bg-red-100 text-red-800' :
                  product.estadoInventario === 'ALTO' ? 'bg-yellow-100 text-yellow-800' :
                  product.estadoInventario === 'MEDIO' ? 'bg-blue-100 text-blue-800' :
                  product.estadoInventario === 'SALUDABLE' ? 'bg-green-100 text-green-800' :
                  'bg-purple-100 text-purple-800'
                }`}>
                  {product.estadoInventario}
                </span>
              </td>
              <td className='px-4 py-4 whitespace-nowrap font-bold text-indigo-600'>{product.cantidadSugerida}</td>
              <td className='px-4 py-4 whitespace-nowrap'>
                <span className={`font-bold ${
                  product.margen > 25 ? 'text-green-600' :
                  product.margen > 15 ? 'text-blue-600' :
                  product.margen > 0 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {product.margen.toFixed(1)}%
                </span>
              </td>
              <td className='px-4 py-4 whitespace-nowrap'>
                <button 
                  onClick={() => router.push(`/evaluate/${product.sku}`)}
                  className='bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-xs'
                >
                  Evaluar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
