/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removido 'output: export' para modo desarrollo
  images: {
    unoptimized: true
  },
  // Variables de entorno públicas
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
}

module.exports = nextConfig
