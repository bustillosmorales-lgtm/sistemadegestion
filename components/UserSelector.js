// components/UserSelector.js
import { useUser } from './UserContext';
import { useRouter } from 'next/router';

const users = {
  user1: { id: 'user1', name: 'Usuario 1 (Chile)', role: 'chile' },
  user2: { id: 'user2', name: 'Usuario 2 (China)', role: 'china' },
  user3: { id: 'user3', name: 'Usuario 3 (Admin)', role: 'admin' },
};

export default function UserSelector() {
  const { user, login, logout } = useUser();
  const router = useRouter();

  const handleLogin = (userId) => {
    login(users[userId]);
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

  return (
    <div className="bg-gray-800 text-white p-2 text-sm flex justify-center items-center gap-4">
      <span>Usuario actual: <strong>{user ? user.name : 'Ninguno'}</strong></span>
      <div className="flex gap-2">
        {Object.keys(users).map(userId => (
          <button 
            key={userId}
            onClick={() => handleLogin(userId)}
            disabled={user?.id === userId}
            className="px-2 py-1 bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-xs"
          >
            {users[userId].name}
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
