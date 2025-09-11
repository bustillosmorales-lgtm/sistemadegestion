-- Tabla para almacenar temporalmente los code_verifiers de PKCE
CREATE TABLE IF NOT EXISTS oauth_pkce_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    code_verifier TEXT NOT NULL,
    code_challenge TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- Índice para limpieza automática de sesiones expiradas
CREATE INDEX IF NOT EXISTS idx_oauth_pkce_sessions_expires_at ON oauth_pkce_sessions(expires_at);

-- Función para limpiar sesiones expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_pkce_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM oauth_pkce_sessions 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE oauth_pkce_sessions IS 'Almacena temporalmente code_verifiers para OAuth PKCE flow';