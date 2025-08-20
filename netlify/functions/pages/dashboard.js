import { useRouter } from 'next/router';
import netlifyIdentity from 'netlify-identity-widget';
import useSWR from 'swr';
import ProductTable from '../components/ProductTable';

const fetcher = url => fetch(url).then(res => res.json());

export default function Dashboard() {
  const router = useRouter();
  const { data, error } = useSWR('/api/analysis', fetcher);
  
  const handleLogout = () => { 
    netlifyIdentity.logout(); 
    router.push('/'); 
  };
  
  return (
    <div className='p-8 bg-gray-50 min-h-screen'>
      <header className='flex justify-between items-center mb-8'>
        <h1 className='text-3xl font-bold text-gray-800'>Dashboard de Gestion Avanzado</h1>
        <div>
          <button 
            onClick={() => router.push('/new-product')} 
            className='bg-green-500 text-white font-bold py-2 px-4 rounded hover:bg-green-600 mr-4'
          >
            + Anadir Nuevo Producto
          </button>
          <button 
            onClick={handleLogout} 
            className='text-sm text-gray-600 hover:text-black'
          >
            Cerrar Sesion
          </button>
        </div>
      </header>
      
      {/* Resumen Ejecutivo */}
      {data && (
        <div className='bg-white p-6 rounded-lg shadow mb-6'>
          <h2 className='text-xl font-semibold mb-4'>Resumen Ejecutivo</h2>
          <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
            <div className='bg-blue-50 p-4 rounded-lg'>
              <h3 className='text-sm font-medium text-blue-600'>Total Productos</h3>
              <p className='text-2xl font-bold text-blue-900'>{data.results.length}</p>
            </div>
            <div className='bg-green-50 p-4 rounded-lg'>
              <h3 className='text-sm font-medium text-green-600'>Stock Total</h3>
              <p className='text-2xl font-bold text-green-900'>
                {data.results.reduce((sum, p) => sum + p.stockActual, 0).toLocaleString()}
              </p>
            </div>
            <div className='bg-yellow-50 p-4 rounded-lg'>
              <h3 className='text-sm font-medium text-yellow-600'>En Transito</h3>
              <p className='text-2xl font-bold text-yellow-900'>
                {data.results.reduce((sum, p) => sum + p.enTransito, 0).toLocaleString()}
              </p>
            </div>
            <div className='bg-purple-50 p-4 rounded-lg'>
              <h3 className='text-sm font-medium text-purple-600'>Margen Promedio</h3>
              <p className='text-2xl font-bold text-purple-900'>
                {(data.results.reduce((sum, p) => sum + p.margen, 0) / data.results.length).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className='bg-white p-6 rounded-lg shadow'>
        <h2 className='text-xl font-semibold mb-4'>Analisis Detallado de Inventario</h2>
        {error && <div className='p-8 text-red-500 font-bold'>Error al cargar los datos.</div>}
        {!data && <div className='p-8'>Cargando...</div>}
        {data && <ProductTable products={data.results} />}
      </div>
    </div>
  );
}
