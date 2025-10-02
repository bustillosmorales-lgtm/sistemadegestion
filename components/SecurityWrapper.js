import { useEffect, useState } from 'react';
import { initAntiDebug, validateDOMIntegrity } from '../lib/security';
import securityMonitor from '../lib/securityMonitor';
import { generateClientFingerprint } from '../lib/apiSecurity';

const SecurityWrapper = ({ children }) => {
  const [isSecure, setIsSecure] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Inicializar protecciones anti-debugging
      initAntiDebug();

      // Inicializar monitor de seguridad
      securityMonitor.startMonitoring();

      // Generar fingerprint del cliente
      const fingerprint = generateClientFingerprint();
      securityMonitor.logSecurityEvent('clientInitialized', {
        fingerprint,
        url: window.location.href,
        referrer: document.referrer
      }, 'info');

      // Validar integridad del DOM periódicamente
      const integrityCheck = setInterval(() => {
        try {
          const isValid = validateDOMIntegrity();
          if (!isValid) {
            securityMonitor.logSecurityEvent('domIntegrityFailure', {
              timestamp: Date.now()
            }, 'high');
            setIsSecure(false);
          }
        } catch (e) {
          securityMonitor.logSecurityEvent('integrityCheckError', {
            error: e.message
          }, 'medium');
          setIsSecure(false);
        }
      }, 30000); // Cada 30 segundos

      // Detectar modificaciones en el DOM
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1 && node.tagName === 'SCRIPT') {
                const src = node.getAttribute('src');
                if (src && !src.includes(window.location.hostname)) {
                  console.warn('Script injection detected:', src);
                  node.remove();
                }
              }
            });
          }
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Protección contra herramientas de análisis
      const antiAnalysis = () => {
        // Detectar extensiones de DevTools comunes
        const extensions = [
          'chrome-extension',
          'moz-extension',
          'webkit-extension'
        ];

        extensions.forEach(ext => {
          if (window.location.href.includes(ext)) {
            setIsSecure(false);
          }
        });

        // Detectar timing attacks (herramientas de análisis)
        const start = performance.now();
        debugger; // Este debugger será removido en producción por el obfuscator
        const end = performance.now();

        if (end - start > 100) {
          // Debugger activo detectado
          if (Math.random() > 0.7) {
            window.location.reload();
          }
        }
      };

      // Ejecutar verificación cada 5 segundos
      const securityInterval = setInterval(antiAnalysis, 5000);

      // Cleanup
      return () => {
        clearInterval(integrityCheck);
        clearInterval(securityInterval);
        observer.disconnect();
      };
    }
  }, []);

  if (!isSecure) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1>Acceso Restringido</h1>
          <p>El sistema ha detectado actividad no autorizada.</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Recargar página
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default SecurityWrapper;