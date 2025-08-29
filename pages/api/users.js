// pages/api/users.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
    if (req.method === 'GET') {
        const { data, error } = await supabase.from('users').select('*');
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
    }

    if (req.method === 'POST') {
        const { email, role } = req.body;
        if (!email || !role) return res.status(400).json({ error: 'Faltan el correo y el rol.' });

        const { data: existingUser } = await supabase.from('users').select('email').eq('email', email).single();
        if (existingUser) return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });

        const newUser = {
            id: `user-${Date.now()}`,
            email,
            role,
            name: `${role === 'chile' ? 'Usuario Chile' : 'Usuario China'} (${email.split('@')[0]})`
        };

        const { data, error } = await supabase.from('users').insert(newUser).select();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json(data[0]);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
}
