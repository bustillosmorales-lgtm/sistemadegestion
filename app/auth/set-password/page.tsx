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
  const router = useRouter();
  const { client, user } = useSupabase();

  const validatePassword = () => {
    if (!password || password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
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

      // Redirigir al home después de 2 segundos
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 2000);
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
            <p className="text-sm text-muted-foreground mb-4">
              Redirigiendo al sistema...
            </p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Establece tu Contraseña</CardTitle>
          <CardDescription className="text-center">
            Configura una contraseña para acceder al sistema
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

            <div className="text-xs text-muted-foreground space-y-1">
              <p>La contraseña debe:</p>
              <ul className="list-disc list-inside pl-2">
                <li>Tener al menos 8 caracteres</li>
                <li>Ser fácil de recordar pero difícil de adivinar</li>
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
