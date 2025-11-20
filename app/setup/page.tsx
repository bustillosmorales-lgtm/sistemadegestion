'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle } from 'lucide-react';

export default function SetupPage() {
  const [email, setEmail] = useState('bustillosmorales@gmail.com');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSendLink = async () => {
    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al enviar link');
      }

      setStatus('success');
      setMessage('Link de acceso enviado! Revisa tu email.');
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Error al enviar link');
    }
  };

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>🔧 Setup - Sistema de Gestión</CardTitle>
          <CardDescription>
            Configuración inicial y diagnóstico de autenticación
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Información del sitio */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Información del sitio:</h3>
            <div className="space-y-1 text-sm">
              <p><strong>URL del sitio:</strong> {siteUrl}</p>
              <p><strong>Callback URL:</strong> {siteUrl}/auth/callback</p>
            </div>
          </div>

          {/* Configuración de Supabase */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="font-semibold text-amber-900 mb-2">⚠️ Configuración requerida en Supabase:</h3>
            <div className="space-y-2 text-sm">
              <p>Ve a: <strong>Supabase Dashboard → Authentication → URL Configuration</strong></p>
              <div className="bg-white p-3 rounded border border-amber-300 mt-2">
                <p className="font-mono text-xs mb-1"><strong>Site URL:</strong></p>
                <code className="bg-gray-100 px-2 py-1 rounded">{siteUrl}</code>

                <p className="font-mono text-xs mt-3 mb-1"><strong>Redirect URLs (agregar):</strong></p>
                <code className="bg-gray-100 px-2 py-1 rounded block">{siteUrl}/**</code>
                <code className="bg-gray-100 px-2 py-1 rounded block mt-1">{siteUrl}/auth/callback</code>
              </div>
            </div>
          </div>

          {/* Enviar Magic Link */}
          <div className="border-t pt-6">
            <h3 className="font-semibold mb-3">Generar link de acceso:</h3>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleSendLink}
                disabled={status === 'loading'}
              >
                {status === 'loading' ? 'Enviando...' : 'Enviar Link'}
              </Button>
            </div>

            {status === 'success' && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div className="text-sm text-green-800">
                  <p className="font-semibold">Link enviado exitosamente!</p>
                  <p className="mt-1">Revisa tu email y haz click en el link para acceder.</p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-semibold">Error:</p>
                  <p className="mt-1">{message}</p>
                </div>
              </div>
            )}
          </div>

          {/* Instrucciones */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm">
            <h3 className="font-semibold mb-2">📋 Pasos para acceder:</h3>
            <ol className="list-decimal list-inside space-y-1 text-gray-700">
              <li>Configura las URLs en Supabase (arriba)</li>
              <li>Haz click en "Enviar Link"</li>
              <li>Revisa tu email</li>
              <li>Click en el link del email</li>
              <li>Serás redirigido y autenticado automáticamente</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
