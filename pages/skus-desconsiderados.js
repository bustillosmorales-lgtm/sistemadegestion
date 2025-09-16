import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useMemo, useEffect } from 'react';
import { useUser } from '../components/UserContext';
import { supabase } from '../lib/supabaseClient';

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function SkusDesconsiderados() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useUser();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(null);
  
  const [skuFilter, setSkuFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user)) {
      router.push('/');
    }
  }, [isAuthenticated, user, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadDesconsiderados();
    }
  }, [isAuthenticated, user]);

  const loadDesconsiderados = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('desconsiderado', true);
      
      if (error) {
        console.error('Error cargando productos desconsiderados:', error);
      } else {
        setProducts(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReactivar = async (sku) => {
    setIsUpdating(sku);
    
    try {
      const res = await fetch(`/api/products?sku=${sku}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ desconsiderado: false }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        alert(`Error: ${errorData.error}`);
      } else {
        await loadDesconsiderados(); // Recargar la lista
        await mutate('/api/analysis', undefined, { revalidate: true }); // Actualizar dashboard
      }
    } catch (err) {
      console.error('❌ Error al reactivar producto:', err);
      alert('Error de conexión al reactivar el producto.');
    } finally {
      setIsUpdating(null);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
        const skuMatch = (p.sku || '').toLowerCase().includes(skuFilter.toLowerCase());
        const nameMatch = (p.descripcion || p.description || '').toLowerCase().includes(nameFilter.toLowerCase());
        return skuMatch && nameMatch;
    });
  }, [products, skuFilter, nameFilter]);

  // Solo admin y chile pueden ver esta página
  if (isLoading) return <div className="p-8 text-center">Cargando...</div>;
  if (!isAuthenticated || !user) return <div className="p-8 text-center">No autorizado</div>;
  if (user.role !== 'admin' && user.role !== 'chile') {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Acceso Denegado</h1>
        <p className="text-gray-600 mb-4">No tienes permisos para ver esta página.</p>
        <Link href="/dashboard"><button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Volver al Dashboard</button></Link>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="sticky top-0 z-20 bg-gray-100/80 backdrop-blur-md shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold">SKUs Desconsiderados</h1>
            <p className="text-sm text-gray-600">Productos que no se incluyen en el análisis ({filteredProducts.length} total)</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard"><button className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 text-sm">← Volver al Dashboard</button></Link>
            <button 
              onClick={() => {
                logout();
                router.push('/');
              }}
              className="bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 text-sm flex items-center gap-2"
            >
              🚪 Cerrar Sesión
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          <input type="text" placeholder="Buscar por SKU..." value={skuFilter} onChange={e => setSkuFilter(e.target.value)} className="w-full border rounded-md p-2 text-sm" />
          <input type="text" placeholder="Buscar por Nombre..." value={nameFilter} onChange={e => setNameFilter(e.target.value)} className="w-full border rounded-md p-2 text-sm" />
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-center py-8">Cargando productos desconsiderados...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <h2 className="text-xl font-bold text-gray-800 mb-2">No hay productos desconsiderados</h2>
            <p className="text-gray-600">Todos los productos están siendo incluidos en el análisis.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProducts.map((product) => (
              <div key={product.sku} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h2 className="text-xl font-bold">{product.descripcion || product.description || 'Sin descripción'}</h2>
                    <p className="text-gray-600 mb-2">SKU: {product.sku}</p>
                    <div className="text-sm text-gray-500 space-y-1">
                      <div>Estado: <span className="font-medium">{product.status}</span></div>
                      <div>Stock: <span className="font-medium">{product.stock_actual || 0} unidades</span></div>
                      <div>Costo FOB: <span className="font-medium">{product.costo_fob_rmb || 0} RMB</span></div>
                      <div>CBM: <span className="font-medium">{product.cbm || 0}</span></div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => handleReactivar(product.sku)}
                      disabled={isUpdating === product.sku}
                      className={`px-4 py-2 rounded font-medium ${
                        isUpdating === product.sku 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-green-500 hover:bg-green-600'
                      } text-white`}
                    >
                      {isUpdating === product.sku ? 'Reactivando...' : '🔄 Reactivar'}
                    </button>
                    <span className="text-xs text-orange-600 font-medium text-center px-2 py-1 bg-orange-100 rounded">
                      Desconsiderado
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}