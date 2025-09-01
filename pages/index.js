// pages/index.js
import { useUser } from '../components/UserContext';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { useState, useEffect } from 'react';

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function LoginPage() {
  const { login, isAuthenticated, isLoading, authenticateWithCode } = useUser();
  const router = useRouter();
  const { data: users, error } = useSWR('/api/users', fetcher);
  
  const [loginType, setLoginType] = useState('select'); // 'select', 'admin', 'sistema', 'usuario', 'userSelect'
  const [codigo, setCodigo] = useState('');
  const [email, setEmail] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Redirigir si ya está autenticado y ha seleccionado usuario
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (isAuthenticated && user) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  if (isLoading) return <div className="p-8 text-center">Cargando...</div>;

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthenticating(true);

    try {
      const result = await authenticateWithCode(loginType, codigo, email);
      
      if (result.success) {
        if (result.user) {
          // Login directo exitoso
          router.push('/dashboard');
        } else if (result.requiresUserSelection) {
          // Código del sistema correcto, pasar a selección de usuario
          setLoginType('userSelect');
        }
      } else {
        setAuthError(result.error);
      }
    } catch (error) {
      setAuthError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleUserLogin = (user) => {
    login(user);
    router.push('/dashboard');
  };

  // Pantalla de selección de tipo de login
  if (loginType === 'select') {
    return (
      <div className='flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-700 via-gray-900 to-black'>
        <div className='p-8 bg-white rounded-xl shadow-2xl text-center max-w-lg w-full'>
          <div className='text-6xl mb-4'>🔐</div>
          <h1 className='text-3xl font-bold mb-4 text-gray-800'>Acceso al Sistema</h1>
          <p className='mb-8 text-gray-600'>Selecciona tu método de acceso</p>
          
          <div className="space-y-4">
            <button 
              onClick={() => setLoginType('admin')}
              className="w-full bg-gradient-to-r from-red-600 to-pink-600 text-white py-4 px-6 rounded-lg hover:from-red-700 hover:to-pink-700 transition-all font-semibold"
            >
              👑 Acceso Admin Directo
            </button>
            
            <button 
              onClick={() => setLoginType('usuario')}
              className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-4 px-6 rounded-lg hover:from-green-700 hover:to-blue-700 transition-all font-semibold"
            >
              👤 Login Usuario Directo  
            </button>
            
            <button 
              onClick={() => setLoginType('sistema')}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-semibold"
            >
              🔑 Código del Sistema
            </button>
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Sistema de Gestión de Inventario • Acceso Autorizado Únicamente
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Pantallas de autenticación específicas
  if (loginType === 'admin' || loginType === 'sistema' || loginType === 'usuario') {
    const configs = {
      admin: {
        title: '👑 Acceso Admin',
        description: 'Ingresa el código de administrador para acceso directo',
        placeholder: 'Código de administrador',
        showEmail: false
      },
      sistema: {
        title: '🔑 Código del Sistema',
        description: 'Ingresa el código del sistema para acceder',
        placeholder: 'Código del sistema',
        showEmail: false
      },
      usuario: {
        title: '👤 Login Usuario',
        description: 'Ingresa tu email para acceso directo',
        placeholder: 'tu@email.com',
        showEmail: true
      }
    };

    const config = configs[loginType];

    return (
      <div className='flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-700 via-gray-900 to-black'>
        <div className='p-8 bg-white rounded-xl shadow-2xl text-center max-w-lg w-full'>
          <div className='text-6xl mb-4'>{loginType === 'admin' ? '👑' : loginType === 'sistema' ? '🔑' : '👤'}</div>
          <h1 className='text-3xl font-bold mb-4 text-gray-800'>{config.title}</h1>
          <p className='mb-6 text-gray-600'>{config.description}</p>
          
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {config.showEmail ? (
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={config.placeholder}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg"
                  required
                  autoFocus
                />
              </div>
            ) : (
              <div>
                <input
                  type="password"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder={config.placeholder}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg"
                  required
                  autoFocus
                />
              </div>
            )}
            
            {authError && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                <p className="text-red-700 text-sm">❌ {authError}</p>
              </div>
            )}
            
            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-semibold disabled:opacity-50"
            >
              {isAuthenticating ? '⚙️ Verificando...' : '🔓 Acceder'}
            </button>
          </form>
          
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button 
              onClick={() => setLoginType('select')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Cambiar método de acceso
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla de selección de usuario (después de código del sistema correcto)
  if (loginType === 'userSelect') {
    if (error) return <div className="p-8 text-center text-red-500">Error al cargar usuarios.</div>;
    if (!users) return <div className="p-8 text-center">Cargando usuarios...</div>;

    return (
      <div className='flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-700 via-gray-900 to-black'>
        <div className='p-8 bg-white rounded-xl shadow-2xl text-center max-w-lg w-full'>
          <div className='text-6xl mb-4'>👤</div>
          <h1 className='text-3xl font-bold mb-4 text-gray-800'>Seleccionar Usuario</h1>
          <p className='mb-6 text-gray-600'>Elige tu rol para acceder al sistema.</p>
          
          <div className="space-y-4">
            {users.map(user => (
              <button 
                key={user.id}
                onClick={() => handleUserLogin(user)} 
                className='w-full px-6 py-4 text-left text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all'
              >
                <p className="font-bold text-lg">{user.name}</p>
                <p className="text-sm opacity-90">{user.email}</p>
                <p className="text-xs opacity-70 capitalize">Rol: {user.role}</p>
              </button>
            ))}
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button 
              onClick={() => setLoginType('select')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Cambiar método de acceso
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback - no debería llegar aquí
  return <div className="p-8 text-center">Cargando...</div>;
}
