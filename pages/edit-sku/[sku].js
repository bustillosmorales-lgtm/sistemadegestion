// pages/edit-sku/[sku].js
import { useRouter } from 'next/router';
import useSWR, { mutate } from 'swr'; // Importamos mutate
import { useState, useEffect } from 'react';

const fetcher = url => fetch(url).then(res => res.json());

export default function EditProductPage() {
  const router = useRouter();
  const { sku } = router.query;

  const { data: product, error: loadError } = useSWR(sku ? `/api/products?sku=${sku}` : null, fetcher);

  const [formData, setFormData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (product) {
      setFormData({
        sku: product.sku,
        descripcion: product.descripcion,
        costoFOB_RMB: product.costoFOB_RMB,
        cbm: product.cbm,
        ventaDiaria: product.ventaDiaria,
        stockActual: product.stockActual
      });
    }
  }, [product]);

  const validateForm = () => {
    if (!formData) return "No hay datos para validar.";
    const { descripcion, costoFOB_RMB, cbm, ventaDiaria } = formData;
    if (!descripcion.trim()) return "La descripción no puede estar vacía.";
    if (!costoFOB_RMB || parseFloat(costoFOB_RMB) <= 0) return "El costo FOB (RMB) debe ser un número positivo.";
    if (!cbm || parseFloat(cbm) <= 0) return "El CBM debe ser un número positivo.";
    if (ventaDiaria === '' || ventaDiaria === null || parseFloat(ventaDiaria) < 0) return "La venta diaria debe ser un número (puede ser 0).";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        // Le decimos a SWR que actualice los datos del dashboard
        mutate('/api/analysis');
        alert('✅ Producto actualizado exitosamente');
        router.push('/dashboard');
      } else {
        const data = await response.json();
        setError(data.error || 'Ocurrió un error al actualizar el producto.');
      }
    } catch (err) {
      setError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (loadError) return <div className="p-8 text-center text-red-600">Error al cargar el producto.</div>
  if (!product || !formData) return <div className="p-8 text-center">Cargando datos del producto...</div>

  return (
    <div className='min-h-screen bg-gray-50'>
      <header className='bg-white shadow-sm border-b'>
        <div className='max-w-4xl mx-auto px-4 py-4'>
          <button onClick={() => router.push('/dashboard')} className='text-blue-600 hover:text-blue-800 flex items-center font-medium'>
            ← Volver al Dashboard
          </button>
        </div>
      </header>

      <main className='max-w-2xl mx-auto px-4 py-8'>
        <div className='bg-white rounded-xl shadow-lg border border-gray-100 p-8'>
          <div className='text-center mb-8'>
            <div className='text-5xl mb-4'>✏️</div>
            <h1 className='text-3xl font-bold text-gray-900 mb-2'>Editar Producto</h1>
            <p className='text-gray-600'>SKU: {product.sku}</p>
          </div>
          
          {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-center">{error}</div>}

          <form onSubmit={handleSubmit} className='space-y-6'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>📝 Descripción del Producto (*)</label>
              <textarea name='descripcion' value={formData.descripcion} onChange={handleChange} className='w-full p-4 border border-gray-300 rounded-lg' rows='3' required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>Costo FOB (RMB) (*)</label>
                <input type='number' name='costoFOB_RMB' value={formData.costoFOB_RMB} onChange={handleChange} className='w-full p-4 border border-gray-300 rounded-lg' min="0.01" step="0.01" required />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>Volumen (CBM) (*)</label>
                <input type='number' name='cbm' value={formData.cbm} onChange={handleChange} className='w-full p-4 border border-gray-300 rounded-lg' min="0.001" step="0.001" required />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>Venta Diaria Est. (*)</label>
                <input type='number' name='ventaDiaria' value={formData.ventaDiaria} onChange={handleChange} className='w-full p-4 border border-gray-300 rounded-lg' min="0" step="0.1" required />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>Stock Actual</label>
                <input type='number' name='stockActual' value={formData.stockActual} onChange={handleChange} className='w-full p-4 border border-gray-300 rounded-lg' min="0" />
              </div>
            </div>
            <div className='flex space-x-4 pt-6'>
              <button type='button' onClick={() => router.push('/dashboard')} className='flex-1 bg-gray-200 text-gray-800 py-3 px-4 rounded-lg font-semibold'>
                ❌ Cancelar
              </button>
              <button type='submit' disabled={isSubmitting} className='flex-1 bg-gradient-to-r from-green-600 to-teal-600 text-white py-3 px-4 rounded-lg font-semibold disabled:opacity-50'>
                {isSubmitting ? '⚙️ Guardando...' : '💾 Guardar Cambios'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}