import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ClientProviders } from './ClientProviders'
import { UserMenu } from '@/components/UserMenu'
import { AuthGuard } from '@/components/AuthGuard'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Sistema de Predicción de Inventario',
  description: 'Predicciones ML de reposición desde China',
  icons: {
    icon: [
      {
        url: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📊</text></svg>',
        type: 'image/svg+xml',
      },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <ClientProviders>
          <AuthGuard>
            <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                  <div className="flex items-center">
                    <h1 className="text-xl font-bold text-gray-900">
                      📊 Predicción Inventario
                    </h1>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-500">
                      {new Date().toLocaleDateString('es-CL')}
                    </span><UserMenu />
                  </div>
                </div>
              </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-200 mt-12">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <p className="text-center text-sm text-gray-500">
                  Sistema ML de Forecasting · Score 8.5/10
                </p>
              </div>
            </footer>
            </div>
          </AuthGuard>
        </ClientProviders>
      </body>
    </html>
  )
}

