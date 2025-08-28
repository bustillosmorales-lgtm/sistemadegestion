// pages/users.js
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { useUser } from '../components/UserContext';

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function UsersPage() {
    const router = useRouter();
    const { user } = useUser();
    const { data: users, error } = useSWR('/api/users', fetcher);

    // Proteger la ruta solo para administradores
    useEffect(() => {
        if (user && user.role !== 'admin') {
            router.push('/dashboard');
        }
    }, [user, router]);

    const handleAddUser = async (event) => {
        event.preventDefault();
        const form = event.target;
        const email = form.email.value;
        const role = form.role.value;

        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, role }),
            });

            if (res.ok) {
                mutate('/api/users'); // Actualiza la lista de usuarios
                form.reset();
            } else {
                const data = await res.json();
                alert(`Error: ${data.error}`);
            }
        } catch (err) {
            alert('Error de conexión al crear usuario.');
        }
    };

    if (!user || user.role !== 'admin') {
        return <div className="p-8 text-center">Redirigiendo...</div>;
    }
    if (error) return <div className="p-8 text-center text-red-500">Error al cargar usuarios.</div>;
    if (!users) return <div className="p-8 text-center">Cargando usuarios...</div>;

    return (
        <div className="p-8 bg-gray-100 min-h-screen">
            <div className="max-w-4xl mx-auto">
                <button onClick={() => router.push('/dashboard')} className="text-blue-600 hover:text-blue-800 mb-4">
                    ← Volver al Dashboard
                </button>
                <h1 className="text-3xl font-bold mb-6">Configuración de Usuarios</h1>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Formulario para agregar nuevo usuario */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold mb-4">Agregar Nuevo Usuario</h2>
                        <form onSubmit={handleAddUser} className="space-y-4">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
                                <input type="email" id="email" name="email" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label htmlFor="role" className="block text-sm font-medium text-gray-700">Rol de Usuario</label>
                                <select id="role" name="role" defaultValue="chile" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                    <option value="chile">Usuario 1 (Chile)</option>
                                    <option value="china">Usuario 2 (China)</option>
                                </select>
                            </div>
                            <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
                                Agregar Usuario
                            </button>
                        </form>
                    </div>

                    {/* Lista de usuarios existentes */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold mb-4">Usuarios Actuales</h2>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {users.map(u => (
                                <div key={u.id} className="p-3 border rounded-md bg-gray-50">
                                    <p className="font-semibold">{u.name}</p>
                                    <p className="text-sm text-gray-600">{u.email}</p>
                                    <p className="text-xs text-gray-500 capitalize mt-1">Rol: {u.role}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
