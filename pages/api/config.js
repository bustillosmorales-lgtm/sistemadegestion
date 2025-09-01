// pages/api/config.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('configuration')
      .select('data')
      .eq('id', 1)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ config: data.data });
  }

  if (req.method === 'POST') {
    const { config } = req.body;
    if (!config) return res.status(400).json({ error: 'Falta el objeto de configuración.' });

    const { error } = await supabase
      .from('configuration')
      .update({ data: config })
      .eq('id', 1);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ message: 'Configuración actualizada exitosamente' });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
