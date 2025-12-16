'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/lib/SupabaseProvider';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { client } = useSupabase();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('=== AUTH CALLBACK DEBUG ===');
        console.log('Full URL:', window.location.href);
        console.log('Hash:', window.location.hash);
        console.log('Search:', window.location.search);

        // OPCIÓN 1: Usar exchangeCodeForSession para flujo PKCE moderno
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (code) {
          console.log('Code found, using PKCE flow');
          const { data, error: exchangeError } = await client.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            console.error('Error exchanging code:', exchangeError);
            setError('Error al procesar el link: ' + exchangeError.message);
            setTimeout(() => router.push('/login'), 3000);
            return;
          }

          console.log('Session established via PKCE:', data.session?.user?.email);
          console.log('User metadata:', {
            last_sign_in_at: data.session?.user?.last_sign_in_at,
            invited_at: data.session?.user?.invited_at,
            created_at: data.session?.user?.created_at,
            email_confirmed_at: data.session?.user?.email_confirmed_at
          });

          // Verificar tipo de autenticación
          const type = urlParams.get('type');

          // MEJORADO: Verificar si usuario tiene roles asignados
          let hasRoles = false;
          try {
            const { data: rolesData } = await client
              .from('user_roles')
              .select('role_id')
              .eq('user_id', data.session?.user?.id)
              .limit(1);
            hasRoles = rolesData && rolesData.length > 0;
            console.log('User has roles:', hasRoles);
          } catch (err) {
            console.error('Error checking roles:', err);
          }

          // Detección robusta: necesita configurar contraseña si:
          // 1. El type es invite/recovery/signup, O
          // 2. El usuario no tiene roles asignados (usuario nuevo)
          const needsPasswordSetup =
            type === 'invite' ||
            type === 'recovery' ||
            type === 'signup' ||
            !hasRoles;

          console.log('Auth type:', type, 'Has roles:', hasRoles, 'Needs password setup:', needsPasswordSetup);

          // Si necesita configurar contraseña → ir a set-password
          if (needsPasswordSetup) {
            console.log('Password setup required, redirecting to set-password');
            setTimeout(() => router.push('/auth/set-password'), 500);
            return;
          }

          // Usuario existente con magic link → redirigir a home
          console.log('Existing user with roles, redirecting to home');
          setTimeout(() => {
            router.push('/');
            router.refresh();
          }, 1000);
          return;
        }

        // OPCIÓN 2: Flujo legacy con tokens en hash
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        console.log('Hash flow - type:', type, 'has token:', !!accessToken);

        if (!accessToken) {
          console.error('No code or access_token found');
          setError('No se encontró información de autenticación en el link. Por favor solicita un nuevo link.');
          setTimeout(() => router.push('/login'), 3000);
          return;
        }

        // Establecer la sesión con los tokens del hash
        const { data, error: sessionError } = await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });

        if (sessionError) {
          console.error('Error al establecer sesión:', sessionError);
          setError('Error al procesar la autenticación: ' + sessionError.message);
          setTimeout(() => router.push('/login'), 3000);
          return;
        }

        console.log('Sesión establecida correctamente:', data.session?.user?.email);
        console.log('User metadata:', {
          last_sign_in_at: data.session?.user?.last_sign_in_at,
          invited_at: data.session?.user?.invited_at,
          created_at: data.session?.user?.created_at
        });

        // MEJORADO: Verificar si usuario tiene roles asignados
        let hasRoles = false;
        try {
          const { data: rolesData } = await client
            .from('user_roles')
            .select('role_id')
            .eq('user_id', data.session?.user?.id)
            .limit(1);
          hasRoles = rolesData && rolesData.length > 0;
          console.log('User has roles:', hasRoles);
        } catch (err) {
          console.error('Error checking roles:', err);
        }

        // Detección robusta: necesita configurar contraseña si:
        // 1. El type es invite/recovery/signup, O
        // 2. El usuario no tiene roles asignados (usuario nuevo)
        const needsPasswordSetup =
          type === 'invite' ||
          type === 'recovery' ||
          type === 'signup' ||
          !hasRoles;

        console.log('Hash flow - type:', type, 'Has roles:', hasRoles, 'Needs password setup:', needsPasswordSetup);

        // Si necesita configurar contraseña → ir a set-password
        if (needsPasswordSetup) {
          console.log('Password setup required, redirecting to set-password');
          setTimeout(() => {
            router.push('/auth/set-password');
          }, 500);
          return;
        }

        // Usuario existente con magic link → redirigir a home
        console.log('Existing user with roles, redirecting to home');
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 1000);
      } catch (err: any) {
        console.error('Error en callback:', err);
        setError('Error al procesar la autenticación: ' + (err.message || 'Error desconocido'));
        setTimeout(() => router.push('/login'), 3000);
      }
    };

    handleAuthCallback();
  }, [client, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">Error de Autenticación</h3>
            <p className="mt-2 text-sm text-gray-500">{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="mt-6 w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Ir al Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-medium text-gray-900">Bienvenido!</h3>
          <p className="mt-2 text-sm text-gray-500">
            Tu cuenta ha sido activada exitosamente. Redirigiendo al dashboard...
          </p>
          <div className="mt-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
