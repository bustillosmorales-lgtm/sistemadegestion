import { useEffect } from 'react';

const SecurityWrapperSimple = ({ children }) => {
  // TEMPORALMENTE DESHABILITADO TODO EL COMPONENTE PARA DEBUG
  /*
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Protecciones deshabilitadas
    }
  }, []);
  */

  return <>{children}</>;
};

export default SecurityWrapperSimple;