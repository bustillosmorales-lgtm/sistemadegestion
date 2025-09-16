// Archivo: pages/quote/[sku].js (Versi n Conectada)
import { useRouter } from 'next/router';

export default function QuoteSkuPage() {
  const router = useRouter();
  const { sku } = router.query;

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    const formData = {
      sku: sku,
      precio_rmb: event.target.precio_rmb.value,
      cbm_embalaje: event.target.cbm_embalaje.value,
      unidades_embalaje: event.target.unidades_embalaje.value,
      ciudad_proveedor: event.target.ciudad_proveedor.value,
    };

    try {
      const response = await fetch('/api/quote/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Error al guardar la cotizaci n.');
      }

      alert(result.message); // Muestra el mensaje de  xito del servidor
      router.push('/dashboard');

    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  return (
    <div className='flex items-center justify-center min-h-screen bg-gray-100'>
      <div className='p-8 bg-white rounded-lg shadow-md w-full max-w-md'>
        <h1 className='text-2xl font-bold mb-2'>Cotizaci n de Proveedor</h1>
        <p className='text-gray-600 mb-6'>Ingresa los datos para el SKU: <strong>{sku}</strong></p>
        <form onSubmit={handleSubmit}>
          <div className='mb-4'>
            <label className='block text-sm font-medium'>Precio FOB (RMB)</label>
            <input name='precio_rmb' type='number' step='0.01' className='mt-1 w-full border rounded p-2' required />
          </div>
          <div className='mb-4'>
            <label className='block text-sm font-medium'>CBM por Embalaje</label>
            <input name='cbm_embalaje' type='number' step='0.001' className='mt-1 w-full border rounded p-2' required />
          </div>
          <div className='mb-4'>
            <label className='block text-sm font-medium'>Unidades por Embalaje</label>
            <input name='unidades_embalaje' type='number' className='mt-1 w-full border rounded p-2' required />
          </div>
          <div className='mb-6'>
            <label className='block text-sm font-medium'>Ciudad del Proveedor</label>
            <input name='ciudad_proveedor' type='text' className='mt-1 w-full border rounded p-2' />
          </div>
          <div className='flex justify-between'>
            <button type='button' onClick={() => router.push('/dashboard')} className='bg-gray-200 px-4 py-2 rounded'>Cancelar</button>
            <button type='submit' className='bg-blue-600 text-white px-4 py-2 rounded'>Guardar Cotizaci n</button>
          </div>
        </form>
      </div>
    </div>
  );
}
