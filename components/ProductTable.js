// Archivo: components/ProductTable.js (Versión con botón dinámico)
import { useRouter } from 'next/router';

export default function ProductTable({ products }) {
  const router = useRouter();
  return (
    <table className='min-w-full text-sm divide-y divide-gray-200'>
      <thead className='bg-gray-50'>
        <tr>
          <th className='px-4 py-3 text-left font-medium'>SKU</th>
          <th className='px-4 py-3 text-left font-medium'>Descripción</th>
          <th className='px-4 py-3 text-left font-medium'>Estado</th>
          <th className='px-4 py-3 text-left font-medium'>Acción</th>
        </tr>
      </thead>
      <tbody className='bg-white divide-y divide-gray-200'>
        {products.map((product) => (
          <tr key={product.sku} className='hover:bg-gray-50'>
            <td className='px-4 py-4 font-medium'>{product.sku}</td>
            <td className='px-4 py-4'>{product.descripcion}</td>
            <td className='px-4 py-4'>
              <span className='px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800'>
                {product.status.replace('_', ' ')}
              </span>
            </td>
            <td className='px-4 py-4'>
              {product.status === 'NECESITA_COTIZACION' ? (
                <button onClick={() => router.push(/quote/ + product.sku)} className='bg-red-500 text-white px-3 py-1 rounded text-xs'>
                  Cotizar
                </button>
              ) : (
                <button onClick={() => router.push(/evaluate/ + product.sku)} className='bg-blue-500 text-white px-3 py-1 rounded text-xs'>
                  Evaluar
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
