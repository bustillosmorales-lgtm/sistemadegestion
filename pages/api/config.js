// pages/api/config.js
import { config } from '../../lib/database';

export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ config });
  }

  if (req.method === 'POST') {
    const newConfig = req.body.config;
    
    // Validación simple en el backend
    if (!newConfig) {
        return res.status(400).json({ error: 'Falta el objeto de configuración.' });
    }

    // Actualizamos cada propiedad del objeto config original
    Object.keys(config).forEach(key => {
        if (newConfig.hasOwnProperty(key)) {
            const value = parseFloat(newConfig[key]);
            if (!isNaN(value)) {
                config[key] = value;
            }
        }
    });

    return res.status(200).json({ message: 'Configuración actualizada exitosamente' });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  // LÍNEA CORREGIDA: El mensaje de error ahora está entre comillas.
  res.status(405).end(`Method ${req.method} Not Allowed`);
}