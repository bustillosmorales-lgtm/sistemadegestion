import { useEffect } from 'react';

const SecurityWrapperSimple = ({ children }) => {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Solo protecciones básicas que no interfieran con Next.js

      // Deshabilitar clic derecho
      const handleContextMenu = (e) => {
        e.preventDefault();
        return false;
      };

      // Deshabilitar teclas de desarrollo
      const handleKeyDown = (e) => {
        if (e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && e.key === 'I') ||
            (e.ctrlKey && e.shiftKey && e.key === 'C') ||
            (e.ctrlKey && e.key === 'U')) {
          e.preventDefault();
          return false;
        }
      };

      // Detectar DevTools por tamaño de ventana (método simple)
      const detectDevTools = () => {
        if (window.outerHeight - window.innerHeight > 200 ||
            window.outerWidth - window.innerWidth > 200) {
          console.clear();
          console.log('%c⚠️ Herramientas de desarrollo detectadas', 'color: red; font-size: 20px;');
        }
      };

      // Agregar listeners
      document.addEventListener('contextmenu', handleContextMenu);
      document.addEventListener('keydown', handleKeyDown);

      // Verificar DevTools cada 3 segundos (menos agresivo)
      const devToolsInterval = setInterval(detectDevTools, 3000);

      // Cleanup
      return () => {
        document.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('keydown', handleKeyDown);
        clearInterval(devToolsInterval);
      };
    }
  }, []);

  return <>{children}</>;
};

export default SecurityWrapperSimple;