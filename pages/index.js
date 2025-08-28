// pages/index.js
import { useUser } from '../components/UserContext';
import { useRouter } from 'next/router';
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function LoginPage() {
  const { login } = useUser();
  const router = useRouter();
  const { data: users, error } = useSWR('/api/users', fetcher);

  if (error) return <div className="p-8 text-center text-red-500">Error al cargar usuarios.</div>;
  if (!users) return <div className="p-8 text-center">Cargando...</div>;

  const handleLogin = (user) => {
    login(user);
    router.push('/dashboard');
  };

  return (
    <div className='flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-700 via-gray-900 to-black'>
      <div className='p-8 bg-white rounded-xl shadow-2xl text-center max-w-lg w-full'>
        <div className='text-6xl mb-4'>👤</div>
        <h1 className='text-3xl font-bold mb-4 text-gray-800'>Seleccionar Usuario</h1>
        <p className='mb-6 text-gray-600'>Elige un rol para acceder al sistema.</p>
        <div className="space-y-4">
          {users.map(user => (
            <button 
              key={user.id}
              onClick={() => handleLogin(user)} 
              className='w-full px-6 py-4 text-left text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all'
            >
              <p className="font-bold text-lg">{user.name}</p>
              <p className="text-sm opacity-90">{user.email}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
