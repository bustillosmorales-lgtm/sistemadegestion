-- MercadoLibre Integration Database Setup
-- Execute this in your Supabase SQL Editor

-- 1. Tabla para almacenar tokens de autenticación de MercadoLibre
CREATE TABLE IF NOT EXISTS ml_auth (
    id SERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    scope TEXT,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla para órdenes de MercadoLibre
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(255) UNIQUE NOT NULL,
    platform VARCHAR(50) DEFAULT 'mercadolibre',
    total_amount DECIMAL(10,2),
    currency_id VARCHAR(10),
    status VARCHAR(50),
    status_detail VARCHAR(255),
    date_created TIMESTAMP WITH TIME ZONE,
    date_closed TIMESTAMP WITH TIME ZONE,
    last_updated TIMESTAMP WITH TIME ZONE,
    expiration_date TIMESTAMP WITH TIME ZONE,
    buyer_data JSONB,
    seller_data JSONB,
    shipping_data JSONB,
    payment_data JSONB,
    items JSONB,
    tags JSONB,
    feedback JSONB,
    context JSONB,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla para mensajes pre y post venta
CREATE TABLE IF NOT EXISTS ml_messages (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(255) UNIQUE NOT NULL,
    order_id VARCHAR(255),
    from_user_id BIGINT,
    to_user_id BIGINT,
    subject VARCHAR(500),
    message_text TEXT,
    message_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50),
    moderation_status VARCHAR(50),
    site_id VARCHAR(10),
    attachments JSONB,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabla para productos/items
CREATE TABLE IF NOT EXISTS ml_items (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(255) UNIQUE NOT NULL,
    title TEXT,
    category_id VARCHAR(255),
    price DECIMAL(10,2),
    currency_id VARCHAR(10),
    available_quantity INTEGER,
    sold_quantity INTEGER,
    condition VARCHAR(50),
    listing_type_id VARCHAR(50),
    status VARCHAR(50),
    permalink TEXT,
    thumbnail TEXT,
    pictures JSONB,
    attributes JSONB,
    variations JSONB,
    shipping_info JSONB,
    seller_info JSONB,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabla para envíos/shipments
CREATE TABLE IF NOT EXISTS ml_shipments (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(255) UNIQUE NOT NULL,
    order_id VARCHAR(255),
    status VARCHAR(50),
    substatus VARCHAR(100),
    mode VARCHAR(50),
    shipping_option_id VARCHAR(255),
    date_created TIMESTAMP WITH TIME ZONE,
    last_updated TIMESTAMP WITH TIME ZONE,
    cost DECIMAL(10,2),
    currency_id VARCHAR(10),
    receiver_address JSONB,
    sender_address JSONB,
    tracking_number VARCHAR(255),
    tracking_method VARCHAR(100),
    service_id VARCHAR(255),
    comments TEXT,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Tabla para promociones
CREATE TABLE IF NOT EXISTS ml_promotions (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(500),
    type VARCHAR(100),
    status VARCHAR(50),
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    discount_type VARCHAR(50),
    discount_value DECIMAL(10,2),
    conditions JSONB,
    items_included JSONB,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Tabla para logs de webhooks
CREATE TABLE IF NOT EXISTS webhook_logs (
    id SERIAL PRIMARY KEY,
    topic VARCHAR(50),
    resource VARCHAR(255),
    user_id BIGINT,
    application_id VARCHAR(255),
    attempts INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Tabla para notificaciones internas del sistema
CREATE TABLE IF NOT EXISTS system_notifications (
    id SERIAL PRIMARY KEY,
    type VARCHAR(100),
    title VARCHAR(500),
    message TEXT,
    data JSONB,
    read BOOLEAN DEFAULT FALSE,
    priority VARCHAR(20) DEFAULT 'normal',
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_orders_external_id ON orders(external_id);
CREATE INDEX IF NOT EXISTS idx_orders_platform ON orders(platform);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date_created ON orders(date_created);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_data ON orders USING GIN(buyer_data);

CREATE INDEX IF NOT EXISTS idx_ml_messages_external_id ON ml_messages(external_id);
CREATE INDEX IF NOT EXISTS idx_ml_messages_order_id ON ml_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_ml_messages_from_user ON ml_messages(from_user_id);

CREATE INDEX IF NOT EXISTS idx_ml_items_external_id ON ml_items(external_id);
CREATE INDEX IF NOT EXISTS idx_ml_items_status ON ml_items(status);
CREATE INDEX IF NOT EXISTS idx_ml_items_category ON ml_items(category_id);

CREATE INDEX IF NOT EXISTS idx_ml_shipments_external_id ON ml_shipments(external_id);
CREATE INDEX IF NOT EXISTS idx_ml_shipments_order_id ON ml_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_ml_shipments_status ON ml_shipments(status);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_topic ON webhook_logs(topic);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_resource ON webhook_logs(resource);

CREATE INDEX IF NOT EXISTS idx_system_notifications_read ON system_notifications(read);
CREATE INDEX IF NOT EXISTS idx_system_notifications_type ON system_notifications(type);
CREATE INDEX IF NOT EXISTS idx_system_notifications_created_at ON system_notifications(created_at);

-- Crear trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger a las tablas relevantes
CREATE TRIGGER update_ml_auth_updated_at BEFORE UPDATE ON ml_auth FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ml_messages_updated_at BEFORE UPDATE ON ml_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ml_items_updated_at BEFORE UPDATE ON ml_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ml_shipments_updated_at BEFORE UPDATE ON ml_shipments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ml_promotions_updated_at BEFORE UPDATE ON ml_promotions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentación
COMMENT ON TABLE ml_auth IS 'Almacena tokens de autenticación OAuth de MercadoLibre';
COMMENT ON TABLE orders IS 'Órdenes sincronizadas desde MercadoLibre';
COMMENT ON TABLE ml_messages IS 'Mensajes pre y post venta de MercadoLibre';
COMMENT ON TABLE ml_items IS 'Productos/items de MercadoLibre';
COMMENT ON TABLE ml_shipments IS 'Información de envíos de MercadoLibre';
COMMENT ON TABLE ml_promotions IS 'Promociones y descuentos de MercadoLibre';
COMMENT ON TABLE webhook_logs IS 'Log de webhooks recibidos de MercadoLibre';
COMMENT ON TABLE system_notifications IS 'Notificaciones internas del sistema';