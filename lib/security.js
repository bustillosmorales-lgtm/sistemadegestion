// Utilidad de seguridad para ofuscar strings sensibles
import CryptoJS from 'crypto-js';

// Clave de encriptación generada dinámicamente
const getSecretKey = () => {
  const timestamp = Math.floor(Date.now() / 3600000) * 3600000; // Cambia cada hora
  return CryptoJS.SHA256(timestamp.toString() + 'sistemadegestion').toString();
};

// Encriptar texto sensible
export const encryptString = (text) => {
  try {
    const key = getSecretKey();
    return CryptoJS.AES.encrypt(text, key).toString();
  } catch (e) {
    return text; // Fallback en caso de error
  }
};

// Desencriptar texto
export const decryptString = (encryptedText) => {
  try {
    const key = getSecretKey();
    const bytes = CryptoJS.AES.decrypt(encryptedText, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    return encryptedText; // Fallback en caso de error
  }
};

// Ofuscar URLs de API
export const obfuscateUrl = (url) => {
  const parts = url.split('/');
  return parts.map((part, index) => {
    if (index > 2 && part.length > 0) { // No ofuscar protocolo y dominio
      return btoa(part).replace(/[+=]/g, '');
    }
    return part;
  }).join('/');
};

// Crear hash para validación de integridad
export const createIntegrityHash = (data) => {
  return CryptoJS.SHA256(JSON.stringify(data)).toString();
};

// Anti-debugging básico
export const initAntiDebug = () => {
  if (typeof window !== 'undefined') {
    // Detectar DevTools (TEMPORALMENTE DESHABILITADO PARA DEBUG)
    /*
    let devtools = { open: false, orientation: null };
    const threshold = 160;

    const detectDevTools = () => {
      if (window.outerHeight - window.innerHeight > threshold ||
          window.outerWidth - window.innerWidth > threshold) {
        if (!devtools.open) {
          devtools.open = true;
          // Redireccionar o mostrar advertencia
          console.clear();
          if (Math.random() > 0.5) {
            window.location.reload();
          }
        }
      } else {
        devtools.open = false;
      }
    };

    // Verificar cada 1 segundo
    setInterval(detectDevTools, 1000);
    */

    // Deshabilitar clic derecho
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });

    // Deshabilitar teclas de desarrollo (TEMPORALMENTE DESHABILITADO PARA DEBUG)
    /*
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F12' ||
          (e.ctrlKey && e.shiftKey && e.key === 'I') ||
          (e.ctrlKey && e.shiftKey && e.key === 'C') ||
          (e.ctrlKey && e.key === 'U')) {
        e.preventDefault();
        return false;
      }
    });
    */

    // Ofuscar console (TEMPORALMENTE DESHABILITADO PARA DEBUG)
    /*
    const originalLog = console.log;
    console.log = () => {};
    console.info = () => {};
    console.warn = () => {};
    console.error = originalLog; // Mantener errores para debugging legítimo
    */
  }
};

// Validar integridad del DOM
export const validateDOMIntegrity = () => {
  if (typeof window !== 'undefined') {
    const scripts = document.querySelectorAll('script');
    let scriptHashes = [];

    scripts.forEach(script => {
      if (script.src && !script.src.includes('sistemadegestion.net')) {
        // Script externo detectado
        console.warn('Script externo detectado:', script.src);
      }
      if (script.innerHTML) {
        scriptHashes.push(CryptoJS.SHA256(script.innerHTML).toString());
      }
    });

    return scriptHashes;
  }
  return [];
};