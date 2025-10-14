// Configuración condicional del bundle analyzer
let withBundleAnalyzer = (config) => config;
try {
  if (process.env.ANALYZE === 'true') {
    const bundleAnalyzer = require('@next/bundle-analyzer');
    withBundleAnalyzer = bundleAnalyzer({
      enabled: true,
    });
  }
} catch (e) {
  console.log('Bundle analyzer not available, skipping...');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true, // Habilitar minificación
  trailingSlash: true,
  // Deshabilitar source maps en producción
  productionBrowserSourceMaps: false,
  images: {
    unoptimized: true
  },
  // Aumentar timeout para APIs de carga masiva
  serverRuntimeConfig: {
    apiTimeout: 300000, // 5 minutos en milisegundos
  },
  compiler: {
    emotion: false,
    reactRemoveProperties: process.env.NODE_ENV === 'production', // Remover propiedades en producción
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error']
    } : false, // Remover console.log en producción
  },
  experimental: {
    esmExternals: false,
    optimizePackageImports: ['crypto-js', 'axios', 'swr']
  },
  webpack: (config, { isServer, dev }) => {
    // Force SWC to use classic JSX runtime
    config.module.rules.forEach((rule) => {
      if (rule.use && rule.use.loader === 'next-swc-loader') {
        if (rule.use.options && rule.use.options.jsConfig) {
          rule.use.options.jsConfig.transform = {
            react: {
              runtime: 'classic'
            }
          };
        }
      }
    });

    // Configuración de optimización para producción
    if (!dev && !isServer) {
      // Obfuscador JavaScript avanzado (solo para archivos específicos)
      try {
        const JavaScriptObfuscator = require('webpack-obfuscator');
        config.plugins.push(
          new JavaScriptObfuscator({
            rotateStringArray: true,
            stringArray: true,
            stringArrayCallsTransform: false, // Reducido para compatibilidad
            stringArrayCallsTransformThreshold: 0.3,
            stringArrayEncoding: ['base64'],
            stringArrayThreshold: 0.5,
            identifierNamesGenerator: 'hexadecimalNumber',
            renameGlobals: false,
            selfDefending: false, // Deshabilitado para evitar problemas
            compact: true,
            controlFlowFlattening: false, // Deshabilitado para compatibilidad
            numbersToExpressions: false,
            simplify: true,
            splitStrings: false,
            transformObjectKeys: false,
            deadCodeInjection: false, // Deshabilitado para evitar errores
            debugProtection: false, // Manejado por SecurityWrapper
            disableConsoleOutput: true,
            domainLock: process.env.DOMAIN_LOCK ? [process.env.DOMAIN_LOCK] : [],
            reservedNames: ['^_', 'require', 'exports', 'module'],
          }, [
            '**/_next/**',
            '**/node_modules/**',
            '**/lib/mercadolibre-service.js' // Excluir archivos problemáticos
          ])
        );
      } catch (e) {
        console.log('JavaScript Obfuscator not available, using standard minification...');
      }

      config.optimization = {
        ...config.optimization,
        minimize: true,
        usedExports: true,
        sideEffects: false,
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000,
          cacheGroups: {
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true
            },
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: -10,
              chunks: 'all'
            }
          }
        }
      };

      // Ocultar nombres de funciones y variables en producción
      config.optimization.minimizer.forEach((minimizer) => {
        if (minimizer.constructor.name === 'TerserPlugin') {
          minimizer.options.terserOptions = {
            ...minimizer.options.terserOptions,
            keep_classnames: false,
            keep_fnames: false,
            mangle: {
              properties: {
                regex: /^_/
              }
            },
            compress: {
              drop_console: true,
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.info', 'console.warn']
            }
          };
        }
      });
    }

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
}

module.exports = withBundleAnalyzer(nextConfig)