// pages/create-sku.js
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { mutate } from 'swr'; // Importamos mutate
import { useUser } from '../components/UserContext';

export default function NewProductPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useUser();

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user || (user.role !== 'admin' && user.role !== 'chile'))) {
      router.push('/');
    }
  }, [isAuthenticated, user, isLoading, router]);
  const [formData, setFormData] = useState({
    descripcion: '',
    cantidad: '',
    link: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion: formData.descripcion,
          cantidad: formData.cantidad || 0,
          link: formData.link,
          costoFOB_RMB: 1,
          cbm: 0.01,
          ventaDiaria: 0
        }),
      });

      if (response.ok) {
        // Le decimos a SWR que actualice los datos del dashboard
        mutate('/api/analysis');
        alert('✅ Producto creado exitosamente');
        router.push('/dashboard');
      } else {
        const data = await response.json();
        setError(data.error || 'Ocurrió un error al crear el producto.');
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

  return (
    <div className='min-h-screen bg-gray-50'>
      <header className='bg-white shadow-sm border-b'>
        <div className='max-w-4xl mx-auto px-4 py-4'>
          <button 
            onClick={() => router.push('/dashboard')} 
            className='text-blue-600 hover:text-blue-800 flex items-center font-medium'
          >
            ← Volver al Dashboard
          </button>
        </div>
      </header>

      <main className='max-w-2xl mx-auto px-4 py-8'>
        <div className='bg-white rounded-xl shadow-lg border border-gray-100 p-8'>
          <div className='text-center mb-8'>
            <div className='text-5xl mb-4'>📦</div>
            <h1 className='text-3xl font-bold text-gray-900 mb-2'>Nuevo Producto</h1>
            <p className='text-gray-600'>Agregue un nuevo producto para cotización</p>
          </div>

          {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-center">{error}</div>}

          <form onSubmit={handleSubmit} className='space-y-6'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                📝 Descripción del Producto
              </label>
              <textarea 
                name='descripcion'
                value={formData.descripcion}
                onChange={handleChange}
                className='w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none'
                rows='4'
                placeholder='Describa detalladamente el producto que desea cotizar...'
                required
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                📊 Cantidad a Comprar
              </label>
              <input 
                type='number' 
                name='cantidad'
                value={formData.cantidad}
                onChange={handleChange}
                className='w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                placeholder='Ej: 100'
                min='1'
                required 
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                🔗 Link de Referencia (Opcional)
              </label>
              <input 
                type='url' 
                name='link'
                value={formData.link}
                onChange={handleChange}
                className='w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                placeholder='https://ejemplo.com/producto'
              />
            </div>

            <div className='flex space-x-4 pt-6'>
              <button 
                type='button' 
                onClick={() => router.push('/dashboard')} 
                className='flex-1 bg-gray-200 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-300 font-semibold transition-all'
              >
                ❌ Cancelar
              </button>
              <button 
                type='submit'
                disabled={isSubmitting}
                className='flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg hover:from-blue-700 hover:to-purple-700 font-semibold transition-all disabled:opacity-50'
              >
                {isSubmitting ? '⚙️ Enviando...' : '📤 Enviar a Cotización'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
