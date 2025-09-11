import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="es">
      <Head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" />
        <meta name="description" content="Sistema de Gestión de Inventario" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}