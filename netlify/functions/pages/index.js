import { useEffect } from 'react';
import { useRouter } from 'next/router';
import netlifyIdentity from 'netlify-identity-widget';

export default function Home() {
  const router = useRouter();
  
  useEffect(() => {
    netlifyIdentity.init();
    const user = netlifyIdentity.currentUser();
    if (user) { 
      router.push('/dashboard'); 
    }
    netlifyIdentity.on('login', () => router.push('/dashboard'));
  }, [router]);
  
  const handleLogin = () => netlifyIdentity.open();
  
  return (
    <div className='flex items-center justify-center min-h-screen bg-gray-100'>
      <div className='p-8 bg-white rounded-lg shadow-md text-center'>
        <h1 className='text-2xl font-bold mb-4'>Sistema de Gestion Avanzado</h1>
        <p className='mb-6'>Por favor, inicie sesion para continuar.</p>
        <button 
          onClick={handleLogin} 
          className='w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700'
        >
          Iniciar Sesion / Registrarse
        </button>
      </div>
    </div>
  );
}
