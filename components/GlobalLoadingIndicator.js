// components/GlobalLoadingIndicator.js - Global loading indicator for dashboard background loading
import React, { useState } from 'react';
import { useDashboardLoader } from './DashboardLoaderContext';

export default function GlobalLoadingIndicator() {
  const {
    isLoading,
    isPaused,
    progressPercentage,
    loadedProducts,
    totalProducts,
    formattedTimeRemaining,
    isComplete,
    pauseLoading,
    resumeLoading,
    resetLoading
  } = useDashboardLoader();

  const [isMinimized, setIsMinimized] = useState(false);

  // Don't show if not loading and not complete
  if (!isLoading && !isComplete) return null;

  // Don't show if minimized and not loading
  if (isMinimized && !isLoading) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
      isMinimized ? 'w-12 h-12' : 'w-80'
    }`}>
      <div className={`bg-white border border-gray-200 rounded-lg shadow-lg ${
        isMinimized ? 'p-2' : 'p-4'
      }`}>

        {/* Minimized view */}
        {isMinimized ? (
          <div
            className="cursor-pointer flex items-center justify-center"
            onClick={() => setIsMinimized(false)}
          >
            {isLoading ? (
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            ) : (
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </div>
            )}
          </div>
        ) : (
          /* Expanded view */
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  isComplete ? 'bg-green-500' :
                  isPaused ? 'bg-yellow-500' :
                  'bg-blue-500 animate-pulse'
                }`}></div>
                <h3 className="text-sm font-medium text-gray-900">
                  {isComplete ? 'Dashboard Cargado' :
                   isPaused ? 'Carga Pausada' :
                   'Cargando Dashboard'}
                </h3>
              </div>

              <button
                onClick={() => setIsMinimized(true)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                −
              </button>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  isComplete ? 'bg-green-500' :
                  isPaused ? 'bg-yellow-500' :
                  'bg-blue-500'
                }`}
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              ></div>
            </div>

            {/* Stats */}
            <div className="text-xs text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>Productos:</span>
                <span className="font-medium">
                  {loadedProducts.toLocaleString()} / {totalProducts.toLocaleString()}
                </span>
              </div>

              {progressPercentage > 0 && (
                <div className="flex justify-between">
                  <span>Progreso:</span>
                  <span className="font-medium">{progressPercentage.toFixed(1)}%</span>
                </div>
              )}

              {formattedTimeRemaining && (
                <div className="flex justify-between">
                  <span>Tiempo restante:</span>
                  <span className="font-medium">{formattedTimeRemaining}</span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex space-x-2 pt-2">
              {isLoading && !isPaused && (
                <button
                  onClick={pauseLoading}
                  className="flex-1 px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded hover:bg-yellow-200 transition-colors"
                >
                  ⏸ Pausar
                </button>
              )}

              {isPaused && (
                <button
                  onClick={resumeLoading}
                  className="flex-1 px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded hover:bg-blue-200 transition-colors"
                >
                  ▶ Continuar
                </button>
              )}

              <button
                onClick={resetLoading}
                className="flex-1 px-3 py-1 bg-red-100 text-red-800 text-xs rounded hover:bg-red-200 transition-colors"
              >
                🗑 Resetear
              </button>
            </div>

            {/* Status message */}
            {isComplete && (
              <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
                ✅ Dashboard cargado completamente. Los datos están disponibles para navegación rápida.
              </div>
            )}

            {isPaused && (
              <div className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded">
                ⏸ Carga pausada. Puedes continuar en cualquier momento.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}