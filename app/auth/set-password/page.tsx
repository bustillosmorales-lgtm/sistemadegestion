'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/lib/SupabaseProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';

export default function SetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasRoles, setHasRoles] = useState(true); // Asumimos que sí hasta que se verifique
  const router = useRouter();
  const { client, user } = useSupabase();

  const validatePassword = () => {
    if (!password || password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return false;
    }
    if (password.length > 72) {
      setError('La contraseña no puede tener más de 72 caracteres');
      return false;
    }
    if (!/[A-Z]/.test(password)) {
      setError('La contraseña debe contener al menos una letra mayúscula');
      return false;
    }
    if (!/[a-z]/.test(password)) {
      setError('La contraseña debe contener al menos una letra minúscula');
      return false;
    }
    if (!/[0-9]/.test(password)) {
      setError('La contraseña debe contener al menos un número');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return false;
    }
    return true;
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validatePassword()) {
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await client.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      setSuccess(true);

      // Verificar si el usuario tiene roles asignados antes de redirigir
      const { data: rolesData } = await client
        .from('user_roles')
        .select('role_id')
        .eq('user_id', user?.id)
        .limit(1);

      const userHasRoles = rolesData && rolesData.length > 0;
      setHasRoles(userHasRoles);

      // Si tiene roles, redirigir al home después de 2 segundos
      if (userHasRoles) {
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 2000);
      } else {
        // Si no tiene roles, mostrar mensaje diferente (sin redirigir automáticamente)
        // El mensaje de éxito indicará que debe esperar a que un admin le asigne un rol
        console.log('User has no roles assigned yet, staying on success page');
      }
    } catch (err: any) {
      console.error('Error setting password:', err);
      setError(err.message || 'Error al establecer la contraseña');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>No hay una sesión activa. Por favor, usa el link del email.</p>
            </div>
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => router.push('/login')}
            >
              Ir al Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-center">Contraseña Establecida</CardTitle>
            <CardDescription className="text-center">
              Tu contraseña ha sido configurada exitosamente
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            {hasRoles ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  Redirigiendo al sistema...
                </p>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  Tu cuenta está lista, pero aún no tienes permisos asignados.
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Por favor contacta al administrador para que te asigne un rol y puedas acceder al sistema.
                </p>
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => router.push('/login')}
                >
                  Volver al Login
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md border-t-4 border-t-blue-600">
        <CardHeader className="space-y-3">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
            <svg
              className="h-6 w-6 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <CardTitle className="text-2xl text-center">Establece tu Contraseña</CardTitle>
          <CardDescription className="text-center">
            Por seguridad, configura una contraseña robusta para acceder al sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm text-destructive">{error}</div>
            </div>
          )}

          <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-sm text-blue-900">
              <strong>Usuario:</strong> {user.email}
            </p>
          </div>

          <form onSubmit={handleSetPassword} className="space-y-4">
            <div>
              <Label htmlFor="password">Nueva Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Repite la contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="text-xs space-y-2 bg-gray-50 p-3 rounded-lg border">
              <p className="font-medium text-gray-700">Requisitos de contraseña:</p>
              <ul className="space-y-1">
                <li className={`flex items-center gap-2 ${password.length >= 8 ? 'text-green-600' : 'text-gray-500'}`}>
                  <span className="text-lg">{password.length >= 8 ? '✓' : '○'}</span>
                  Mínimo 8 caracteres
                </li>
                <li className={`flex items-center gap-2 ${/[A-Z]/.test(password) ? 'text-green-600' : 'text-gray-500'}`}>
                  <span className="text-lg">{/[A-Z]/.test(password) ? '✓' : '○'}</span>
                  Al menos una mayúscula (A-Z)
                </li>
                <li className={`flex items-center gap-2 ${/[a-z]/.test(password) ? 'text-green-600' : 'text-gray-500'}`}>
                  <span className="text-lg">{/[a-z]/.test(password) ? '✓' : '○'}</span>
                  Al menos una minúscula (a-z)
                </li>
                <li className={`flex items-center gap-2 ${/[0-9]/.test(password) ? 'text-green-600' : 'text-gray-500'}`}>
                  <span className="text-lg">{/[0-9]/.test(password) ? '✓' : '○'}</span>
                  Al menos un número (0-9)
                </li>
                <li className={`flex items-center gap-2 ${password && confirmPassword && password === confirmPassword ? 'text-green-600' : 'text-gray-500'}`}>
                  <span className="text-lg">{password && confirmPassword && password === confirmPassword ? '✓' : '○'}</span>
                  Las contraseñas coinciden
                </li>
              </ul>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Estableciendo...' : 'Establecer Contraseña'}
            </Button>
          </form>

          <p className="mt-4 text-xs text-center text-muted-foreground">
            Podrás usar esta contraseña para futuros inicios de sesión
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
