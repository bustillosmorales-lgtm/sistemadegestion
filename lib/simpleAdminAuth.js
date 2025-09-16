// lib/simpleAdminAuth.js - Autenticación admin simple compatible con el sistema actual

// Verificar si un usuario es administrador (función simple)
export function isUserAdmin(user) {
    if (!user) return false;
    
    return user.role === 'admin' || 
           user.email === process.env.ADMIN_EMAIL ||
           user.type === 'admin';
}

// Middleware simple para operaciones que requieren admin
export function requireAdminForPOST(handler) {
    return async (req, res) => {
        // Solo verificar admin para operaciones de modificación
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
            const user = req.body?.user;
            
            if (!user) {
                return res.status(401).json({ 
                    error: 'Usuario requerido para esta operación',
                    code: 'USER_REQUIRED'
                });
            }
            
            if (!isUserAdmin(user)) {
                return res.status(403).json({ 
                    error: 'Se requieren privilegios de administrador para esta operación',
                    code: 'ADMIN_REQUIRED'
                });
            }
            
            // Agregar usuario al request para uso posterior
            req.user = user;
        }
        
        return await handler(req, res);
    };
}

// Verificación rápida para componentes React
export function useSimpleAdminCheck() {
    if (typeof window === 'undefined') return false;
    
    try {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) return false;
        
        const user = JSON.parse(storedUser);
        return isUserAdmin(user);
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}