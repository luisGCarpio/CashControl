-- Esquema Multi-Tenant para Control de Caja Real
-- Cada usuario posee su propio espacio aislado de productos, movimientos y recordatorios.

DROP TABLE IF EXISTS movements CASCADE;
DROP TABLE IF EXISTS reminders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Tabla de Usuarios (Dueños de negocio / inquilinos independientes)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    business_name VARCHAR(100) NOT NULL DEFAULT 'Mi Negocio',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Productos (aislados por user_id)
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    supply_model VARCHAR(20) NOT NULL CHECK (supply_model IN ('REVENTA', 'PRODUCCION')),
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    extra_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    sale_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Movimientos de Dinero (aislados por user_id)
CREATE TABLE movements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('ENTRADA', 'SALIDA')),
    category VARCHAR(40) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
    is_unplanned BOOLEAN DEFAULT FALSE,
    movement_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla de Recordatorios de Pago (aislados por user_id)
CREATE TABLE reminders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    category VARCHAR(40) NOT NULL DEFAULT 'SERVICIOS_ARRIENDO',
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('UNICO', 'SEMANAL', 'QUINCENAL', 'MENSUAL')),
    due_date DATE NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices de alto rendimiento para consultas filtradas por inquilino (user_id)
CREATE INDEX idx_products_user ON products(user_id, active);
CREATE INDEX idx_movements_user_date ON movements(user_id, movement_date DESC);
CREATE INDEX idx_movements_user_type ON movements(user_id, type, category);
CREATE INDEX idx_movements_product ON movements(product_id);
CREATE INDEX idx_reminders_user_due ON reminders(user_id, due_date, is_completed);

-- Usuario inicial semilla (admin / admin123)
INSERT INTO users (username, password_hash, business_name)
VALUES (
    'admin',
    '$2a$10$hj7gbZ6nE01bG3qIppEv2.HUo.2Q2dgiah./2j7xvao6R6/ht4ON2',
    'Control de Caja - Negocio Principal'
);
