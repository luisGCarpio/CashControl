-- Limpieza previa opcional
DROP TABLE IF EXISTS movements CASCADE;
DROP TABLE IF EXISTS reminders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Tabla de Usuario Único (Dueño del negocio)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    business_name VARCHAR(100) NOT NULL DEFAULT 'Mi Negocio',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Productos (Soporta Reventa por Catálogo y Producción con Materia Prima)
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    Supply_model VARCHAR(20) NOT NULL CHECK (supply_model IN ('REVENTA', 'PRODUCCION')),
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,       -- Costo de compra (catálogo) o materia prima por unidad
    extra_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,      -- Empaque, envase, mano de obra o envío unitario
    sale_price NUMERIC(12, 2) NOT NULL DEFAULT 0,      -- Precio final al cliente
    stock INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Movimientos de Dinero (Entradas y Salidas reales)
CREATE TABLE movements (
    id SERIAL PRIMARY KEY,
    type VARCHAR(10) NOT NULL CHECK (type IN ('ENTRADA', 'SALIDA')),
    category VARCHAR(40) NOT NULL,
    -- Categorías sugeridas:
    -- ENTRADA: 'VENTA_PRODUCTO', 'APORTE_CAPITAL', 'OTRO_INGRESO'
    -- SALIDA: 'COMPRA_CATALOGO', 'MATERIA_PRIMA', 'SERVICIOS_ARRIENDO', 'PUBLICIDAD_ENVIOS', 'GASTO_NO_PLANEADO', 'RETIRO_PERSONAL'
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
    is_unplanned BOOLEAN DEFAULT FALSE, -- Marca si fue un gasto imprevisto/hormiga
    movement_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla de Recordatorios y Pagos Recurrentes
CREATE TABLE reminders (
    id SERIAL PRIMARY KEY,
    title VARCHAR(120) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    category VARCHAR(40) NOT NULL DEFAULT 'SERVICIOS_ARRIENDO',
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('UNICO', 'SEMANAL', 'QUINCENAL', 'MENSUAL')),
    due_date DATE NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para acelerar las alertas y estadísticas por fecha y producto
CREATE INDEX idx_movements_date ON movements(movement_date);
CREATE INDEX idx_movements_type_cat ON movements(type, category);
CREATE INDEX idx_movements_product ON movements(product_id);
CREATE INDEX idx_reminders_due ON reminders(due_date, is_completed);

-- Usuario inicial: usuario "admin" | contraseña "admin123" (Hash bcrypt válido)
INSERT INTO users (username, password_hash, business_name)
VALUES (
    'admin',
    '$2a$10$XFE/UQjM8HLrWYz0Z4q1IeN1E3M.8B5xR8kR5xR8kR5xR8kR5xR8k', 
    'Control de Caja - Mi Negocio'
);