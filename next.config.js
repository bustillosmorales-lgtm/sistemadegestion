/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',  // Static export para Netlify
  images: {
    unoptimized: true  // Necesario para export estático
  },
  // Variables de entorno públicas
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
}

module.exports = nextConfig
