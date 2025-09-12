// pages/dashboard-status.js - Dashboard súper rápido por status
import Head from 'next/head';
import { useUser } from '../components/UserContext';
import StatusSummaryDashboard from '../components/StatusSummaryDashboard';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function DashboardStatus() {
  const { user, isAuthenticated, isLoading, logout } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user)) {
      router.push('/');
    }
  }, [isAuthenticated, user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Dashboard por Status - Sistema de Gestión</title>
        <meta name="description" content="Vista rápida del dashboard organizada por status de productos" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Header de navegación */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <img src="/logo.png" alt="Logo Dashboard" className="h-8 md:h-10" />
              <span className="ml-3 text-xl font-semibold text-gray-900">
                Dashboard por Status ⚡
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {user.email}
              </span>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md hover:bg-gray-100"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Componente principal del dashboard por status */}
      <StatusSummaryDashboard />
    </>
  );
}