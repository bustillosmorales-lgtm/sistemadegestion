// pages/api/users.js
import { database } from '../../lib/database';

export default function handler(req, res) {
    if (req.method === 'GET') {
        return res.status(200).json(database.users);
    }

    if (req.method === 'POST') {
        const { email, role } = req.body;

        if (!email || !role) {
            return res.status(400).json({ error: 'Faltan el correo y el rol.' });
        }
        if (database.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
            return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
        }

        const newUser = {
            id: `user-${Date.now()}`,
            email,
            role,
            name: `${role === 'chile' ? 'Usuario Chile' : 'Usuario China'} (${email.split('@')[0]})`
        };

        database.users.push(newUser);
        return res.status(201).json(newUser);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
}
