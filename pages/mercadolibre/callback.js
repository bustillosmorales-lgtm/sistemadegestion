import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function MercadoLibreCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Procesando autorización con MercadoLibre...');
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        const { code, state, error: authError } = router.query;

        if (authError) {
          setStatus('error');
          setMessage(`Error en autorización: ${authError}`);
          return;
        }

        if (!code) {
          setStatus('error');
          setMessage('Código de autorización no recibido');
          return;
        }

        setMessage('Intercambiando código por tokens...');

        // Llamar al API endpoint para procesar el callback
        const response = await fetch(`/api/mercadolibre/callback?code=${code}&state=${state}`);
        const result = await response.json();

        if (result.success) {
          setStatus('success');
          setMessage('¡Conexión exitosa con MercadoLibre!');
          setUserInfo(result.user);
          
          // Redirigir al dashboard después de 3 segundos
          setTimeout(() => {
            router.push('/dashboard');
          }, 3000);
        } else {
          setStatus('error');
          setMessage(result.error || 'Error al conectar con MercadoLibre');
        }

      } catch (error) {
        console.error('Error procesando callback:', error);
        setStatus('error');
        setMessage('Error interno al procesar la autorización');
      }
    };

    if (router.isReady) {
      processCallback();
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Autorización MercadoLibre
            </h2>
            
            <div className="mt-8">
              {status === 'processing' && (
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-sm text-gray-600">{message}</p>
                </div>
              )}

              {status === 'success' && (
                <div className="flex flex-col items-center">
                  <div className="rounded-full h-12 w-12 bg-green-100 flex items-center justify-center mb-4">
                    <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <p className="text-sm text-green-600 font-medium">{message}</p>
                  
                  {userInfo && (
                    <div className="mt-4 p-4 bg-green-50 rounded-md">
                      <h3 className="text-sm font-medium text-green-800">Usuario conectado:</h3>
                      <p className="text-sm text-green-700">
                        {userInfo.nickname} ({userInfo.email})
                      </p>
                      <p className="text-sm text-green-700">
                        País: {userInfo.country_id} | Sitio: {userInfo.site_id}
                      </p>
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-500 mt-4">
                    Redirigiendo al dashboard en unos segundos...
                  </p>
                </div>
              )}

              {status === 'error' && (
                <div className="flex flex-col items-center">
                  <div className="rounded-full h-12 w-12 bg-red-100 flex items-center justify-center mb-4">
                    <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </div>
                  <p className="text-sm text-red-600 font-medium">{message}</p>
                  
                  <div className="mt-6">
                    <button
                      onClick={() => router.push('/dashboard')}
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Volver al Dashboard
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}