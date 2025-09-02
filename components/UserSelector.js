// components/UserSelector.js
import { useUser } from './UserContext';
import { useRouter } from 'next/router';
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function UserSelector() {
  const { user, login, logout } = useUser();
  const router = useRouter();
  const { data: users, error } = useSWR('/api/users', fetcher);

  const handleLogin = (userData) => {
    login(userData);
    if (router.pathname === '/') {
      router.push('/dashboard');
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (router.pathname === '/') {
    return null; // No mostrar en la página de login
  }

  if (error) return null; // No mostrar si hay error
  if (!users) return null; // No mostrar mientras carga

  return (
    <div className="bg-gray-800 text-white p-2 text-sm flex justify-center items-center gap-4">
      <span>Usuario actual: <strong>{user ? user.name : 'Ninguno'}</strong></span>
      <div className="flex gap-2">
        {users.map(userData => (
          <button 
            key={userData.id}
            onClick={() => handleLogin(userData)}
            disabled={user?.id === userData.id}
            className="px-2 py-1 bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-xs"
          >
            {userData.name}
          </button>
        ))}
        {user && (
          <button onClick={handleLogout} className="px-2 py-1 bg-red-600 rounded-md hover:bg-red-700 text-xs">
            Cerrar Sesión
          </button>
        )}
      </div>
    </div>
  );
}
