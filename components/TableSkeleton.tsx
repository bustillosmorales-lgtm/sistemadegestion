/**
 * Table skeleton loading components
 * Provides visual loading states for different table types
 */

import { Skeleton } from '@/components/ui/skeleton'

interface TableSkeletonProps {
  rows?: number
  columns?: number
}

/**
 * Generic table skeleton
 */
export function TableSkeleton({ rows = 10, columns = 6 }: TableSkeletonProps) {
  return (
    <div className="w-full">
      {/* Table header skeleton */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>

      {/* Table rows skeleton */}
      <div className="divide-y divide-gray-200">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="px-6 py-4">
            <div className="flex gap-4 items-center">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton
                  key={colIndex}
                  className="h-5 flex-1"
                  style={{
                    width: colIndex === 0 ? '80px' : undefined, // SKU column
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Predicciones table skeleton with specific column layout
 */
export function PrediccionesTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="w-full overflow-x-auto">
      {/* Table header */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
        <div className="grid grid-cols-12 gap-2 min-w-[1400px]">
          <Skeleton className="h-4 col-span-1" /> {/* Checkbox */}
          <Skeleton className="h-4 col-span-1" /> {/* SKU */}
          <Skeleton className="h-4 col-span-2" /> {/* Descripción */}
          <Skeleton className="h-4 col-span-1" /> {/* ABC */}
          <Skeleton className="h-4 col-span-1" /> {/* Venta Diaria */}
          <Skeleton className="h-4 col-span-1" /> {/* Stock */}
          <Skeleton className="h-4 col-span-1" /> {/* Días Stock */}
          <Skeleton className="h-4 col-span-1" /> {/* Sugerencia */}
          <Skeleton className="h-4 col-span-1" /> {/* Precio */}
          <Skeleton className="h-4 col-span-1" /> {/* Valor Total */}
          <Skeleton className="h-4 col-span-1" /> {/* Acciones */}
        </div>
      </div>

      {/* Table rows */}
      <div className="divide-y divide-gray-200">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="px-6 py-4 hover:bg-gray-50">
            <div className="grid grid-cols-12 gap-2 items-center min-w-[1400px]">
              <Skeleton className="h-5 w-5 rounded col-span-1" />
              <Skeleton className="h-5 col-span-1" />
              <Skeleton className="h-5 col-span-2" />
              <Skeleton className="h-5 w-8 col-span-1" />
              <Skeleton className="h-5 col-span-1" />
              <Skeleton className="h-5 col-span-1" />
              <Skeleton className="h-5 col-span-1" />
              <Skeleton className="h-5 col-span-1" />
              <Skeleton className="h-5 col-span-1" />
              <Skeleton className="h-5 col-span-1" />
              <div className="col-span-1 flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Cotizaciones table skeleton
 */
export function CotizacionesTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="w-full overflow-x-auto">
      {/* Table header */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
        <div className="grid grid-cols-10 gap-2 min-w-[1200px]">
          <Skeleton className="h-4 col-span-1" /> {/* SKU */}
          <Skeleton className="h-4 col-span-2" /> {/* Descripción */}
          <Skeleton className="h-4 col-span-1" /> {/* Cantidad */}
          <Skeleton className="h-4 col-span-1" /> {/* Estado */}
          <Skeleton className="h-4 col-span-1" /> {/* Fecha */}
          <Skeleton className="h-4 col-span-1" /> {/* Costo */}
          <Skeleton className="h-4 col-span-1" /> {/* Notas */}
          <Skeleton className="h-4 col-span-2" /> {/* Acciones */}
        </div>
      </div>

      {/* Table rows */}
      <div className="divide-y divide-gray-200">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="px-6 py-4 hover:bg-gray-50">
            <div className="grid grid-cols-10 gap-2 items-center min-w-[1200px]">
              <Skeleton className="h-5 col-span-1" />
              <Skeleton className="h-5 col-span-2" />
              <Skeleton className="h-5 col-span-1" />
              <Skeleton className="h-5 w-20 col-span-1" />
              <Skeleton className="h-5 col-span-1" />
              <Skeleton className="h-5 col-span-1" />
              <Skeleton className="h-5 col-span-1" />
              <div className="col-span-2 flex gap-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Contenedores table skeleton
 */
export function ContenedoresTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="w-full overflow-x-auto">
      {/* Table header */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
        <div className="grid grid-cols-8 gap-2 min-w-[1000px]">
          <Skeleton className="h-4 col-span-1" /> {/* SKU */}
          <Skeleton className="h-4 col-span-2" /> {/* Descripción */}
          <Skeleton className="h-4 col-span-1" /> {/* Unidades */}
          <Skeleton className="h-4 col-span-1" /> {/* Estado */}
          <Skeleton className="h-4 col-span-1" /> {/* Contenedor */}
          <Skeleton className="h-4 col-span-1" /> {/* Fecha */}
          <Skeleton className="h-4 col-span-1" /> {/* Acciones */}
        </div>
      </div>

      {/* Table rows */}
      <div className="divide-y divide-gray-200">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="px-6 py-4 hover:bg-gray-50">
            <div className="grid grid-cols-8 gap-2 items-center min-w-[1000px]">
              <Skeleton className="h-5 col-span-1" />
              <Skeleton className="h-5 col-span-2" />
              <Skeleton className="h-5 col-span-1" />
              <Skeleton className="h-5 w-20 col-span-1" />
              <Skeleton className="h-5 col-span-1" />
              <Skeleton className="h-5 col-span-1" />
              <div className="col-span-1 flex gap-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
