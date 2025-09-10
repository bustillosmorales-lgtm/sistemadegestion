// lib/apiClients.js - Clientes para APIs externas
import { supabase } from './supabaseClient';

// Cliente para MercadoLibre API
export class MercadoLibreClient {
    constructor(accessToken = null, refreshToken = null) {
        this.baseURL = 'https://api.mercadolibre.com';
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.appId = process.env.NEXT_PUBLIC_MERCADOLIBRE_APP_ID;
        this.clientSecret = process.env.MERCADOLIBRE_CLIENT_SECRET;
    }

    // Obtener URL de autorización OAuth
    getAuthURL(redirectURI) {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.appId,
            redirect_uri: redirectURI,
            state: Math.random().toString(36).substring(7) // Estado para seguridad
        });
        return `${this.baseURL}/authorization?${params.toString()}`;
    }

    // Intercambiar código por token de acceso
    async getAccessToken(code, redirectURI) {
        const response = await fetch(`${this.baseURL}/oauth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                client_id: this.appId,
                client_secret: this.clientSecret,
                code: code,
                redirect_uri: redirectURI
            })
        });

        if (!response.ok) {
            throw new Error(`Error obteniendo token: ${response.statusText}`);
        }

        return await response.json();
    }

    // Refrescar token de acceso
    async refreshAccessToken() {
        if (!this.refreshToken) {
            throw new Error('No hay refresh token disponible');
        }

        const response = await fetch(`${this.baseURL}/oauth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                grant_type: 'refresh_token',
                client_id: this.appId,
                client_secret: this.clientSecret,
                refresh_token: this.refreshToken
            })
        });

        if (!response.ok) {
            throw new Error(`Error refrescando token: ${response.statusText}`);
        }

        const tokenData = await response.json();
        this.accessToken = tokenData.access_token;
        this.refreshToken = tokenData.refresh_token;
        return tokenData;
    }

    // Realizar petición autenticada
    async request(endpoint, options = {}) {
        if (!this.accessToken) {
            throw new Error('Token de acceso requerido para MercadoLibre');
        }

        const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
        console.log(`🔄 MercadoLibre API Request: ${options.method || 'GET'} ${url}`);

        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'SistemaGestion/1.0',
                ...options.headers
            }
        });

        if (response.status === 401) {
            // Token expirado, intentar refrescar
            try {
                await this.refreshAccessToken();
                // Reintentar petición con nuevo token
                return await this.request(endpoint, options);
            } catch (error) {
                throw new Error('Token expirado y no se pudo refrescar');
            }
        }

        if (!response.ok) {
            const error = await response.text();
            console.error(`❌ MercadoLibre API Error: ${response.status} ${response.statusText}`, error);
            
            // Parsear el error de MercadoLibre si es JSON
            try {
                const errorData = JSON.parse(error);
                if (errorData.message) {
                    throw new Error(`MercadoLibre: ${errorData.message}`);
                }
            } catch (parseError) {
                // No es JSON, usar error crudo
            }
            
            throw new Error(`MercadoLibre API Error: ${response.status} - ${error}`);
        }

        const result = await response.json();
        console.log(`✅ MercadoLibre API Response:`, result);
        return result;
    }

    // Obtener información del usuario
    async getUserInfo() {
        return await this.request('/users/me');
    }

    // Obtener productos/items
    async getItems(sellerId, status = 'active') {
        return await this.request(`/users/${sellerId}/items/search?status=${status}`);
    }

    // Obtener detalles de un item
    async getItem(itemId) {
        return await this.request(`/items/${itemId}`);
    }

    // Actualizar stock de un item
    async updateItemStock(itemId, availableQuantity) {
        return await this.request(`/items/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify({
                available_quantity: availableQuantity
            })
        });
    }

    // Pausar/despausar publicación
    async pauseItem(itemId, pause = true) {
        return await this.request(`/items/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify({
                status: pause ? 'paused' : 'active'
            })
        });
    }

    // Obtener órdenes
    async getOrders(sellerId, offset = 0, limit = 50) {
        return await this.request(`/orders/search?seller=${sellerId}&offset=${offset}&limit=${limit}`);
    }
}

// Cliente para Defontana API
export class DefontanaClient {
    constructor(apiKey = null, baseURL = 'https://www.defontana.com/api') {
        this.baseURL = baseURL;
        this.apiKey = apiKey || process.env.DEFONTANA_API_KEY;
        this.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
        };
    }

    // Realizar petición
    async request(endpoint, options = {}) {
        if (!this.apiKey) {
            throw new Error('API Key de Defontana requerida');
        }

        const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                ...this.headers,
                ...options.headers
            }
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Defontana API Error: ${response.status} - ${error}`);
        }

        return await response.json();
    }

    // Obtener productos
    async getProducts() {
        return await this.request('/products');
    }

    // Obtener producto por SKU
    async getProductBySKU(sku) {
        return await this.request(`/products?sku=${sku}`);
    }

    // Actualizar stock de producto
    async updateProductStock(productId, stock) {
        return await this.request(`/products/${productId}`, {
            method: 'PUT',
            body: JSON.stringify({ stock })
        });
    }

    // Crear venta/factura
    async createInvoice(invoiceData) {
        return await this.request('/invoices', {
            method: 'POST',
            body: JSON.stringify(invoiceData)
        });
    }

    // Obtener facturas
    async getInvoices(from = null, to = null) {
        let endpoint = '/invoices';
        if (from || to) {
            const params = new URLSearchParams();
            if (from) params.append('from', from);
            if (to) params.append('to', to);
            endpoint += `?${params.toString()}`;
        }
        return await this.request(endpoint);
    }
}

// Función para obtener configuración de APIs desde la base de datos
export async function getAPIConfig(apiName) {
    const { data, error } = await supabase
        .from('api_configurations')
        .select('*')
        .eq('api_name', apiName)
        .eq('active', true)
        .single();

    if (error && error.code !== 'PGRST116') { // No existe la tabla
        console.error(`Error obteniendo configuración de ${apiName}:`, error);
        return null;
    }

    return data;
}

// Función para guardar configuración de API
export async function saveAPIConfig(apiName, config) {
    const { data, error } = await supabase
        .from('api_configurations')
        .upsert({
            api_name: apiName,
            config: config,
            active: true,
            updated_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        throw new Error(`Error guardando configuración de ${apiName}: ${error.message}`);
    }

    return data;
}

// Función para crear instancias de clientes con configuración de DB
export async function createMercadoLibreClient() {
    const config = await getAPIConfig('mercadolibre');
    if (!config) return new MercadoLibreClient();
    
    return new MercadoLibreClient(config.config.access_token, config.config.refresh_token);
}

export async function createDefontanaClient() {
    const config = await getAPIConfig('defontana');
    if (!config) return new DefontanaClient();
    
    return new DefontanaClient(config.config.api_key, config.config.base_url);
}