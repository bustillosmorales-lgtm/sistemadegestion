import { useRouter } from 'next/router';

export default function NewProductPage() {
  const router = useRouter();
  
  const handleSubmit = (e) => { 
    e.preventDefault(); 
    alert('Producto enviado a cotizacion (CONECTADO)'); 
    router.push('/dashboard'); 
  };
  
  return (
    <div className='flex items-center justify-center min-h-screen bg-gray-100'>
      <div className='p-8 bg-white rounded-lg shadow-md w-full max-w-md'>
        <h1 className='text-2xl font-bold mb-6'>Introducir Nuevo Producto</h1>
        <div>
          <div className='mb-4'>
            <label className='block text-sm'>Descripcion</label>
            <textarea className='w-full border rounded p-2' required></textarea>
          </div>
          <div className='mb-4'>
            <label className='block text-sm'>Cantidad</label>
            <input type='number' className='w-full border rounded p-2' required />
          </div>
          <div className='mb-6'>
            <label className='block text-sm'>Link</label>
            <input type='url' className='w-full border rounded p-2' />
          </div>
          <div className='flex justify-between'>
            <button 
              onClick={() => router.push('/dashboard')} 
              className='bg-gray-200 px-4 py-2 rounded'
            >
              Cancelar
            </button>
            <button 
              onClick={handleSubmit} 
              className='bg-blue-600 text-white px-4 py-2 rounded'
            >
              Enviar a Cotizacion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
