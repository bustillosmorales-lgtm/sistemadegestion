// lib/adminAuth.js - Control de acceso administrativo
import { supabase } from './supabaseClient';
import { useState, useEffect } from 'react';

// Verificar si el usuario es administrador
export async function verifyAdminAccess(req) {
    // Para compatibilidad con el sistema actual, verificar usuario en body o headers
    let user = null;
    
    // Opción 1: Usuario en el body de la request (desde frontend)
    if (req.body && req.body.user) {
        user = req.body.user;
    }
    
    // Opción 2: Token en headers (para APIs futuras)
    if (!user && req.headers.authorization) {
        try {
            const token = req.headers.authorization.replace('Bearer ', '');
            const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
            if (!error && supabaseUser) {
                user = supabaseUser;
            }
        } catch (error) {
            // Continuar con verificación alternativa
            console.log('Token Supabase no válido, verificando sistema local');
        }
    }
    
    if (!user) {
        throw new Error('Usuario no autenticado. Se requiere iniciar sesión.');
    }
    
    // Verificar rol de administrador
    const isAdmin = user.role === 'admin' || 
                    user.email === process.env.ADMIN_EMAIL ||
                    await checkAdminInDatabase(user.id);
    
    if (!isAdmin) {
        throw new Error('Acceso denegado. Se requieren privilegios de administrador');
    }
    
    return user;
}

// Verificar admin en base de datos (alternativo)
async function checkAdminInDatabase(userId) {
    const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .single();
    
    return !!data;
}

// Middleware para endpoints que requieren admin
export function requireAdmin(handler) {
    return async (req, res) => {
        try {
            const user = await verifyAdminAccess(req);
            req.user = user;
            return await handler(req, res);
        } catch (error) {
            console.error('Error de autenticación admin:', error);
            return res.status(403).json({ 
                error: error.message,
                code: 'ADMIN_ACCESS_REQUIRED'
            });
        }
    };
}

// Hook para verificar admin en componentes React
export function useAdminAuth() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    
    useEffect(() => {
        checkAdminStatus();
    }, []);
    
    async function checkAdminStatus() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            
            if (!session) {
                setIsAdmin(false);
                setUser(null);
                setLoading(false);
                return;
            }
            
            // Verificar rol admin
            const isAdminUser = session.user.user_metadata?.role === 'admin' ||
                               session.user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL ||
                               await checkAdminInDatabase(session.user.id);
            
            setIsAdmin(isAdminUser);
            setUser(session.user);
            
        } catch (error) {
            console.error('Error verificando estado admin:', error);
            setIsAdmin(false);
            setUser(null);
        } finally {
            setLoading(false);
        }
    }
    
    return { isAdmin, loading, user, checkAdminStatus };
}

// Componente de protección para páginas admin
export function AdminProtection({ children, fallback = null }) {
    const { isAdmin, loading } = useAdminAuth();
    
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Verificando permisos...</span>
            </div>
        );
    }
    
    if (!isAdmin) {
        return fallback || (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">🔒</span>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        Acceso Denegado
                    </h2>
                    <p className="text-gray-600 mb-6">
                        Se requieren privilegios de administrador para acceder a esta sección.
                    </p>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                        Volver al Inicio
                    </button>
                </div>
            </div>
        );
    }
    
    return children;
}