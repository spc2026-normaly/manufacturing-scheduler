-- PostgreSQL DDL Schema for Manufacturing Scheduler
-- Enforces NOT NULL on all columns and maps to appropriate PostgreSQL data types.

-- 1. Clean up existing tables (with CASCADE to handle dependencies)
DROP TABLE IF EXISTS schedule_assignments CASCADE;
DROP TABLE IF EXISTS untitled CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS safety_training CASCADE;
DROP TABLE IF EXISTS required_equipments CASCADE;
DROP TABLE IF EXISTS equipments CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS task CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS employees CASCADE;

-- 2. Create tables

-- employees table
CREATE TABLE employees (
    emp_id VARCHAR(255) NOT NULL,
    login_id VARCHAR(255) NOT NULL,
    login_pw VARCHAR(255) NOT NULL,
    emp_name VARCHAR(255) NOT NULL,
    emp_role VARCHAR(50) NOT NULL,
    emp_date DATE NOT NULL,
    CONSTRAINT PK_EMPLOYEES PRIMARY KEY (emp_id),
    CONSTRAINT UQ_EMPLOYEES_LOGIN_ID UNIQUE (login_id),
    CONSTRAINT CK_EMPLOYEES_ROLE CHECK (emp_role IN ('leader', 'member'))
);

-- orders table
CREATE TABLE orders (
    order_id VARCHAR(255) NOT NULL,
    order_num VARCHAR(255) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    order_count INTEGER NOT NULL,
    due_date DATE NOT NULL,
    order_status VARCHAR(50) NOT NULL,
    CONSTRAINT PK_ORDERS PRIMARY KEY (order_id)
);

-- task table
CREATE TABLE task (
    task_id VARCHAR(255) NOT NULL,
    task_level VARCHAR(50) NOT NULL,
    task_name VARCHAR(255) NOT NULL,
    task_type VARCHAR(100) NOT NULL,
    task_time INTEGER NOT NULL, -- duration in minutes
    CONSTRAINT PK_TASK PRIMARY KEY (task_id)
);

-- schedules table
CREATE TABLE schedules (
    id VARCHAR(255) NOT NULL,
    task_id VARCHAR(255) NOT NULL,
    order_id VARCHAR(255) NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    factory VARCHAR(255) NOT NULL,
    CONSTRAINT PK_SCHEDULES PRIMARY KEY (id, task_id, order_id),
    CONSTRAINT FK_task_TO_schedules FOREIGN KEY (task_id) REFERENCES task (task_id) ON DELETE CASCADE,
    CONSTRAINT FK_orders_TO_schedules FOREIGN KEY (order_id) REFERENCES orders (order_id) ON DELETE CASCADE
);

-- schedule_assignments (originally Untitled)
CREATE TABLE schedule_assignments (
    id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    task_id VARCHAR(255) NOT NULL,
    order_id VARCHAR(255) NOT NULL,
    CONSTRAINT PK_SCHEDULE_ASSIGNMENTS PRIMARY KEY (id, user_id, task_id, order_id),
    CONSTRAINT FK_schedules_TO_assignments FOREIGN KEY (id, task_id, order_id) REFERENCES schedules (id, task_id, order_id) ON DELETE CASCADE,
    CONSTRAINT FK_employees_TO_assignments FOREIGN KEY (user_id) REFERENCES employees (emp_id) ON DELETE CASCADE
);

-- safety_training table
CREATE TABLE safety_training (
    training_id VARCHAR(255) NOT NULL,
    emp_id VARCHAR(255) NOT NULL,
    training_name VARCHAR(255) NOT NULL,
    training_date DATE NOT NULL,
    expired_date DATE NOT NULL,
    training_status VARCHAR(50) NOT NULL,
    CONSTRAINT PK_SAFETY_TRAINING PRIMARY KEY (training_id, emp_id),
    CONSTRAINT FK_employees_TO_safety_training FOREIGN KEY (emp_id) REFERENCES employees (emp_id) ON DELETE CASCADE
);

-- equipments table
CREATE TABLE equipments (
    eq_id VARCHAR(255) NOT NULL,
    eq_name VARCHAR(255) NOT NULL,
    eq_count INTEGER NOT NULL,
    available_eq_count INTEGER NOT NULL,
    check_cycle INTEGER NOT NULL, -- check cycle in days
    eq_status VARCHAR(50) NOT NULL DEFAULT '정상', -- 상태 (예: 정상, 점검 필요)
    check_date DATE NOT NULL,
    recent_check_date DATE NOT NULL,
    CONSTRAINT PK_EQUIPMENTS PRIMARY KEY (eq_id)
);

-- required_equipments table
CREATE TABLE required_equipments (
    task_id VARCHAR(255) NOT NULL,
    eq_id VARCHAR(255) NOT NULL,
    CONSTRAINT PK_REQUIRED_EQUIPMENTS PRIMARY KEY (task_id, eq_id),
    CONSTRAINT FK_task_TO_required_equipments FOREIGN KEY (task_id) REFERENCES task (task_id) ON DELETE CASCADE,
    CONSTRAINT FK_equipments_TO_required_equipments FOREIGN KEY (eq_id) REFERENCES equipments (eq_id) ON DELETE CASCADE
);

-- documents table
CREATE TABLE documents (
    file_id VARCHAR(255) NOT NULL,
    uploader VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL, -- size in bytes
    file_extension VARCHAR(50) NOT NULL,
    file_path TEXT NOT NULL,
    is_template BOOLEAN NOT NULL DEFAULT FALSE,
    file_created_at TIMESTAMP NOT NULL,
    file_updated_at TIMESTAMP NOT NULL,
    embedding_date TIMESTAMP NOT NULL,
    embedding_status VARCHAR(50) NOT NULL,
    CONSTRAINT PK_DOCUMENTS PRIMARY KEY (file_id, uploader),
    CONSTRAINT FK_employees_TO_documents FOREIGN KEY (uploader) REFERENCES employees (emp_id) ON DELETE CASCADE
);

-- 3. Comments for documentation and code clarity
COMMENT ON COLUMN equipments.eq_status IS '장비 상태 (정상, 점검 필요 등)';
COMMENT ON COLUMN equipments.check_cycle IS '점검 주기 (일 단위)';
COMMENT ON COLUMN task.task_time IS '작업 소요 시간 (분 단위)';
