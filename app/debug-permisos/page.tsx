'use client';

import { useSupabase } from '@/lib/SupabaseProvider';
import { useUserPermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DebugPermisosPage() {
  const { client, session, user } = useSupabase();
  const { permissions, roles, isAdmin, isLoading, error } = useUserPermissions();

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold">🔍 Debug de Permisos</h1>

      <Card>
        <CardHeader>
          <CardTitle>Información de Usuario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <strong>User ID:</strong> {user?.id || 'No user'}
          </div>
          <div>
            <strong>Email:</strong> {user?.email || 'No email'}
          </div>
          <div>
            <strong>Session:</strong> {session ? 'Activa' : 'No hay sesión'}
          </div>
          <div>
            <strong>Access Token:</strong> {session?.access_token ? 'Presente' : 'No hay token'}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hook useUserPermissions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <strong>isLoading:</strong> {isLoading ? 'Sí' : 'No'}
          </div>
          <div>
            <strong>isAdmin:</strong> {isAdmin ? '✅ SÍ' : '❌ NO'}
          </div>
          <div>
            <strong>Error:</strong> {error ? error.message : 'Sin errores'}
          </div>
          <div>
            <strong>Roles detectados:</strong> {roles.length > 0 ? roles.join(', ') : 'Ninguno'}
          </div>
          <div>
            <strong>Permisos detectados:</strong> {permissions.length} permisos
          </div>
        </CardContent>
      </Card>

      {permissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Lista de Permisos</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside">
              {permissions.map((p) => (
                <li key={p} className="text-sm">{p}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Query Manual</CardTitle>
        </CardHeader>
        <CardContent>
          <button
            onClick={async () => {
              if (!user) {
                alert('No hay usuario');
                return;
              }

              // Query directa a user_roles
              const { data, error } = await client
                .from('user_roles')
                .select('role_id')
                .eq('user_id', user.id);

              console.log('Query result:', { data, error });
              alert(`Roles: ${JSON.stringify(data)}\nError: ${error?.message || 'ninguno'}`);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Consultar roles directamente
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
