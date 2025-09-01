// pages/users.js
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { useUser } from '../components/UserContext';

const fetcher = (url) => fetch(url).then((res) => res.json());

const defaultRoles = ['admin', 'chile', 'china'];

export default function UsersPage() {
    const router = useRouter();
    const { user } = useUser();
    const { data: users, error } = useSWR('/api/users', fetcher);
    const { data: customRolesFromAPI } = useSWR('/api/roles', fetcher, {
        onError: (err) => console.log('Roles API not available:', err)
    });
    
    // Sincronizar roles personalizados con API
    useEffect(() => {
        if (customRolesFromAPI) {
            setCustomRoles(customRolesFromAPI);
        }
    }, [customRolesFromAPI]);
    const [editingUser, setEditingUser] = useState(null);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [customRoles, setCustomRoles] = useState([]);
    const [newRoleName, setNewRoleName] = useState('');
    const [newRolePermissions, setNewRolePermissions] = useState({
        canViewConfig: false,
        canViewUsers: false,
        canViewContainers: false,
        canViewFinancials: false,
        canManageProducts: false,
        canProcessOrders: false
    });
    const [adminCode, setAdminCode] = useState('');
    const [systemCode, setSystemCode] = useState('');
    const [isUpdatingAdminCode, setIsUpdatingAdminCode] = useState(false);
    const [isUpdatingSystemCode, setIsUpdatingSystemCode] = useState(false);
    
    // Cargar códigos actuales si es usuario admin (temporal: cualquier admin)
    useEffect(() => {
        if (user && user.role === 'admin') {
            const loadCodes = async () => {
                try {
                    // Cargar códigos desde configuración
                    const res = await fetch('/api/config');
                    if (res.ok) {
                        const configData = await res.json();
                        setAdminCode(configData.config?.codigoAdmin || '');
                        setSystemCode(configData.config?.codigoSistema || '987654');
                    } else {
                        console.error('Error cargando configuración:', res.status);
                        // Usar valores por defecto
                        setAdminCode('');
                        setSystemCode('987654');
                    }
                } catch (err) {
                    console.error('Error cargando códigos:', err);
                    // Usar valores por defecto
                    setAdminCode('');
                    setSystemCode('987654');
                }
            };
            loadCodes();
        }
    }, [user]);

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
        const name = form.name.value;
        const role = form.role.value;

        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, name, role }),
            });

            if (res.ok) {
                mutate('/api/users');
                form.reset();
            } else {
                const data = await res.json();
                alert(`Error: ${data.error}`);
            }
        } catch (err) {
            alert('Error de conexión al crear usuario.');
        }
    };

    const handleEditUser = async (event) => {
        event.preventDefault();
        const form = event.target;
        const name = form.name.value;
        const role = form.role.value;

        try {
            const res = await fetch(`/api/users/${editingUser.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, role }),
            });

            if (res.ok) {
                mutate('/api/users');
                setEditingUser(null);
            } else {
                const data = await res.json();
                alert(`Error: ${data.error}`);
            }
        } catch (err) {
            alert('Error de conexión al actualizar usuario.');
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!confirm('¿Estás seguro de que quieres eliminar este usuario?')) return;

        try {
            const res = await fetch(`/api/users/${userId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                mutate('/api/users');
            } else {
                const data = await res.json();
                alert(`Error: ${data.error}`);
            }
        } catch (err) {
            alert('Error de conexión al eliminar usuario.');
        }
    };

    const handleCreateRole = async (event) => {
        event.preventDefault();
        
        try {
            const res = await fetch('/api/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: newRoleName,
                    permissions: newRolePermissions 
                }),
            });

            if (res.ok) {
                setCustomRoles([...(Array.isArray(customRoles) ? customRoles : []), { name: newRoleName, permissions: newRolePermissions }]);
                setNewRoleName('');
                setNewRolePermissions({
                    canViewConfig: false,
                    canViewUsers: false,
                    canViewContainers: false,
                    canViewFinancials: false,
                    canManageProducts: false,
                    canProcessOrders: false
                });
                setShowRoleModal(false);
            } else {
                const data = await res.json();
                alert(`Error: ${data.error}`);
            }
        } catch (err) {
            alert('Error de conexión al crear rol.');
        }
    };

    const handleUpdateAdminCode = async (event) => {
        event.preventDefault();
        setIsUpdatingAdminCode(true);
        
        try {
            // Primero obtener la configuración actual
            const configRes = await fetch('/api/config');
            const configData = configRes.ok ? await configRes.json() : { config: {} };
            
            // Actualizar solo el código admin
            const updatedConfig = {
                ...configData.config,
                codigoAdmin: adminCode
            };
            
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: updatedConfig }),
            });

            if (res.ok) {
                alert('✅ Código de acceso admin actualizado correctamente');
            } else {
                const data = await res.json();
                alert(`Error: ${data.error}`);
            }
        } catch (err) {
            alert('Error de conexión al actualizar código admin.');
        } finally {
            setIsUpdatingAdminCode(false);
        }
    };

    const handleUpdateSystemCode = async (event) => {
        event.preventDefault();
        setIsUpdatingSystemCode(true);
        
        try {
            // Primero obtener la configuración actual
            const configRes = await fetch('/api/config');
            const configData = configRes.ok ? await configRes.json() : { config: {} };
            
            // Actualizar solo el código del sistema
            const updatedConfig = {
                ...configData.config,
                codigoSistema: systemCode
            };
            
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: updatedConfig }),
            });

            if (res.ok) {
                alert('✅ Código del sistema actualizado correctamente');
            } else {
                const data = await res.json();
                alert(`Error: ${data.error}`);
            }
        } catch (err) {
            alert('Error de conexión al actualizar código del sistema.');
        } finally {
            setIsUpdatingSystemCode(false);
        }
    };

    if (!user || user.role !== 'admin') {
        return <div className="p-8 text-center">Redirigiendo...</div>;
    }
    if (error) return <div className="p-8 text-center text-red-500">Error al cargar usuarios.</div>;
    if (!users) return <div className="p-8 text-center">Cargando usuarios...</div>;

    const allRoles = [...defaultRoles, ...Array.isArray(customRoles) ? customRoles.map(r => r.name) : []];

    return (
        <>
            {/* Modal para crear nuevo rol */}
            {showRoleModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-screen overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">Crear Nuevo Rol</h2>
                        <form onSubmit={handleCreateRole} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Rol</label>
                                <input 
                                    type="text" 
                                    value={newRoleName}
                                    onChange={(e) => setNewRoleName(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                    required 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Permisos</label>
                                <div className="space-y-2">
                                    {Object.entries(newRolePermissions).map(([key, value]) => (
                                        <label key={key} className="flex items-center">
                                            <input 
                                                type="checkbox" 
                                                checked={value}
                                                onChange={(e) => setNewRolePermissions({
                                                    ...newRolePermissions,
                                                    [key]: e.target.checked
                                                })}
                                                className="mr-2"
                                            />
                                            <span className="text-sm">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button 
                                    type="button" 
                                    onClick={() => setShowRoleModal(false)}
                                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    Crear Rol
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal para editar usuario */}
            {editingUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">Editar Usuario: {editingUser.email}</h2>
                        <form onSubmit={handleEditUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                                <input 
                                    type="text" 
                                    name="name"
                                    defaultValue={editingUser.name}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                    required 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                                <select 
                                    name="role" 
                                    defaultValue={editingUser.role}
                                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md"
                                >
                                    {allRoles.map(role => (
                                        <option key={role} value={role}>{role}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button 
                                    type="button" 
                                    onClick={() => setEditingUser(null)}
                                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="p-8 bg-gray-100 min-h-screen">
                <div className="max-w-6xl mx-auto">
                    <button onClick={() => router.push('/dashboard')} className="text-blue-600 hover:text-blue-800 mb-4">
                        ← Volver al Dashboard
                    </button>
                    <h1 className="text-3xl font-bold mb-6">Configuración de Usuarios y Roles</h1>
                    
                    {/* Debug temporal */}
                    {process.env.NODE_ENV === 'development' && user && (
                        <div className="bg-gray-100 p-2 mb-4 text-xs">
                            Debug: User ID = {user.id} (tipo: {typeof user.id})
                        </div>
                    )}

                    {/* Sección de Código Admin - Solo para usuario admin (temporal: cualquier admin) */}
                    {user && user.role === 'admin' && (
                        <div className="bg-red-50 border border-red-200 rounded-lg shadow-md p-6 mb-8">
                            <h2 className="text-xl font-semibold mb-4 text-red-800">🔐 Configuración de Códigos de Seguridad</h2>
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                                <p className="text-yellow-800 text-sm">
                                    ⚠️ <strong>Importante:</strong> Estos códigos controlan el acceso al sistema. 
                                    Como administrador, puedes modificar estos códigos de seguridad.
                                </p>
                            </div>
                            
                            {/* Código Admin */}
                            <div className="mb-6">
                                <h3 className="text-lg font-medium text-red-700 mb-3">👑 Código de Acceso Admin</h3>
                                <form onSubmit={handleUpdateAdminCode} className="flex gap-4 items-end">
                                    <div className="flex-1">
                                        <input 
                                            type="password" 
                                            value={adminCode} 
                                            onChange={(e) => setAdminCode(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500" 
                                            placeholder="Código para acceso directo admin"
                                            disabled={false}
                                            required
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Permite acceso directo como administrador
                                        </p>
                                    </div>
                                    <button 
                                        type="submit" 
                                        disabled={isUpdatingAdminCode}
                                        className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
                                    >
                                        {isUpdatingAdminCode ? '⚙️ Actualizando...' : '💾 Actualizar'}
                                    </button>
                                </form>
                            </div>

                            {/* Código Sistema */}
                            <div>
                                <h3 className="text-lg font-medium text-blue-700 mb-3">🔑 Código del Sistema</h3>
                                <form onSubmit={handleUpdateSystemCode} className="flex gap-4 items-end">
                                    <div className="flex-1">
                                        <input 
                                            type="password" 
                                            value={systemCode} 
                                            onChange={(e) => setSystemCode(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
                                            placeholder="Código para acceso al sistema"
                                            disabled={false}
                                            required
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Permite acceder al sistema y seleccionar usuario
                                        </p>
                                    </div>
                                    <button 
                                        type="submit" 
                                        disabled={isUpdatingSystemCode}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        {isUpdatingSystemCode ? '⚙️ Actualizando...' : '💾 Actualizar'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Formulario para agregar nuevo usuario */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h2 className="text-xl font-semibold mb-4">Agregar Nuevo Usuario</h2>
                            <form onSubmit={handleAddUser} className="space-y-4">
                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nombre</label>
                                    <input type="text" id="name" name="name" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                                </div>
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
                                    <input type="email" id="email" name="email" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                                </div>
                                <div>
                                    <label htmlFor="role" className="block text-sm font-medium text-gray-700">Rol</label>
                                    <select id="role" name="role" defaultValue="chile" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                        {allRoles.map(role => (
                                            <option key={role} value={role}>{role}</option>
                                        ))}
                                    </select>
                                </div>
                                <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
                                    Agregar Usuario
                                </button>
                            </form>
                        </div>

                        {/* Lista de usuarios existentes */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold">Usuarios Actuales</h2>
                            </div>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {users.map(u => (
                                    <div key={u.id} className="p-3 border rounded-md bg-gray-50">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold">{u.name}</p>
                                                <p className="text-sm text-gray-600">{u.email}</p>
                                                <p className="text-xs text-gray-500 capitalize mt-1">Rol: {u.role}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => setEditingUser(u)}
                                                    className="text-blue-600 hover:text-blue-800 text-xs"
                                                >
                                                    ✏️ Editar
                                                </button>
                                                {u.role !== 'admin' && (
                                                    <button 
                                                        onClick={() => handleDeleteUser(u.id)}
                                                        className="text-red-600 hover:text-red-800 text-xs"
                                                    >
                                                        🗑️ Eliminar
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Gestión de roles */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold">Roles Disponibles</h2>
                                <button 
                                    onClick={() => setShowRoleModal(true)}
                                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                                >
                                    + Crear Rol
                                </button>
                            </div>
                            <div className="space-y-3">
                                {defaultRoles.map(role => (
                                    <div key={role} className="p-3 border rounded-md bg-blue-50">
                                        <p className="font-semibold capitalize">{role}</p>
                                        <p className="text-xs text-gray-500">Rol del sistema</p>
                                    </div>
                                ))}
                                {Array.isArray(customRoles) ? customRoles.map(role => (
                                    <div key={role.name} className="p-3 border rounded-md bg-green-50">
                                        <p className="font-semibold capitalize">{role.name}</p>
                                        <p className="text-xs text-gray-500">Rol personalizado</p>
                                        <div className="text-xs text-gray-600 mt-1">
                                            Permisos: {Object.entries(role.permissions).filter(([k,v]) => v).map(([k,v]) => k).join(', ')}
                                        </div>
                                    </div>
                                )) : null}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
