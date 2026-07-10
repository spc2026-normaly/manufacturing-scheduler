BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 8df4d0461bc8

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE employees (
    emp_id VARCHAR(255) NOT NULL, 
    login_id VARCHAR(255) NOT NULL, 
    login_pw VARCHAR(255) NOT NULL, 
    emp_name VARCHAR(255) NOT NULL, 
    emp_role VARCHAR(50) NOT NULL, 
    emp_date DATE NOT NULL, 
    PRIMARY KEY (emp_id), 
    CONSTRAINT "CK_EMPLOYEES_ROLE" CHECK (emp_role IN ('leader', 'member'))
);

CREATE UNIQUE INDEX ix_employees_login_id ON employees (login_id);

CREATE TABLE orders (
    order_id VARCHAR(255) NOT NULL, 
    order_num VARCHAR(255) NOT NULL, 
    product_name VARCHAR(255) NOT NULL, 
    order_count INTEGER NOT NULL, 
    due_date DATE NOT NULL, 
    order_status VARCHAR(50) NOT NULL, 
    PRIMARY KEY (order_id)
);

CREATE TABLE task (
    task_id VARCHAR(255) NOT NULL, 
    task_level VARCHAR(50) NOT NULL, 
    task_name VARCHAR(255) NOT NULL, 
    task_type VARCHAR(100) NOT NULL, 
    task_factory VARCHAR(255), 
    task_time INTEGER NOT NULL, 
    PRIMARY KEY (task_id)
);

CREATE TABLE equipments (
    eq_id VARCHAR(255) NOT NULL, 
    eq_name VARCHAR(255) NOT NULL, 
    eq_count INTEGER NOT NULL, 
    available_eq_count INTEGER NOT NULL, 
    check_cycle INTEGER NOT NULL, 
    eq_status VARCHAR(50) NOT NULL, 
    check_date DATE NOT NULL, 
    recent_check_date DATE NOT NULL, 
    durability INTEGER NOT NULL, 
    rest_duration INTEGER NOT NULL, 
    PRIMARY KEY (eq_id)
);

CREATE TABLE required_equipments (
    task_id VARCHAR(255) NOT NULL, 
    eq_id VARCHAR(255) NOT NULL, 
    PRIMARY KEY (task_id, eq_id), 
    FOREIGN KEY(task_id) REFERENCES task (task_id) ON DELETE CASCADE, 
    FOREIGN KEY(eq_id) REFERENCES equipments (eq_id) ON DELETE CASCADE
);

CREATE TABLE schedules (
    id VARCHAR(255) NOT NULL, 
    task_id VARCHAR(255) NOT NULL, 
    order_id VARCHAR(255) NOT NULL, 
    start_date TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    end_date TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    factory VARCHAR(255) NOT NULL, 
    PRIMARY KEY (id, task_id, order_id), 
    FOREIGN KEY(task_id) REFERENCES task (task_id) ON DELETE CASCADE, 
    FOREIGN KEY(order_id) REFERENCES orders (order_id) ON DELETE CASCADE
);

CREATE TABLE schedule_assignments (
    id VARCHAR(255) NOT NULL, 
    user_id VARCHAR(255) NOT NULL, 
    task_id VARCHAR(255) NOT NULL, 
    order_id VARCHAR(255) NOT NULL, 
    PRIMARY KEY (id, user_id, task_id, order_id), 
    FOREIGN KEY(id, task_id, order_id) REFERENCES schedules (id, task_id, order_id) ON DELETE CASCADE, 
    FOREIGN KEY(user_id) REFERENCES employees (emp_id) ON DELETE CASCADE
);

CREATE TABLE documents (
    file_id VARCHAR(255) NOT NULL, 
    uploader VARCHAR(255) NOT NULL, 
    file_name VARCHAR(255) NOT NULL, 
    file_size BIGINT NOT NULL, 
    file_extension VARCHAR(50) NOT NULL, 
    file_path TEXT NOT NULL, 
    is_template BOOLEAN NOT NULL, 
    file_created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    file_updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    embedding_date TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    embedding_status VARCHAR(50) NOT NULL, 
    PRIMARY KEY (file_id, uploader), 
    FOREIGN KEY(uploader) REFERENCES employees (emp_id) ON DELETE CASCADE
);

CREATE TABLE safety_training (
    training_id VARCHAR(255) NOT NULL, 
    emp_id VARCHAR(255) NOT NULL, 
    training_name VARCHAR(255) NOT NULL, 
    training_date DATE NOT NULL, 
    expired_date DATE NOT NULL, 
    training_status VARCHAR(50) NOT NULL, 
    PRIMARY KEY (training_id, emp_id), 
    FOREIGN KEY(emp_id) REFERENCES employees (emp_id) ON DELETE CASCADE
);

CREATE TABLE safety_training_metadata (
    metadata_id VARCHAR(255) NOT NULL, 
    training_names JSON NOT NULL, 
    updated_at DATE NOT NULL, 
    PRIMARY KEY (metadata_id)
);

CREATE TABLE token_usage_logs (
    id VARCHAR(255) NOT NULL, 
    feature VARCHAR(100) NOT NULL, 
    model_name VARCHAR(100) NOT NULL, 
    prompt_tokens INTEGER NOT NULL, 
    completion_tokens INTEGER NOT NULL, 
    total_tokens INTEGER NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id)
);

CREATE TABLE users (
    emp_id SERIAL NOT NULL, 
    emp_name VARCHAR(50) NOT NULL, 
    login_id VARCHAR(255) NOT NULL, 
    login_pw VARCHAR(255) NOT NULL, 
    hashed_password VARCHAR(255) NOT NULL, 
    emp_role VARCHAR(30) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (emp_id)
);

CREATE INDEX ix_users_emp_id ON users (emp_id);

CREATE UNIQUE INDEX ix_users_emp_name ON users (emp_name);

CREATE TABLE chat_sessions (
    session_id VARCHAR(255) NOT NULL, 
    employee_id VARCHAR(255), 
    title VARCHAR(255) NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    last_activity TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (session_id), 
    FOREIGN KEY(employee_id) REFERENCES employees (emp_id) ON DELETE SET NULL
);

CREATE TABLE document_chunks (
    chunk_id VARCHAR(255) NOT NULL, 
    file_id VARCHAR(255) NOT NULL, 
    uploader VARCHAR(255) NOT NULL, 
    chunk_index INTEGER NOT NULL, 
    content TEXT NOT NULL, 
    embedding VECTOR(1536) NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (chunk_id), 
    FOREIGN KEY(file_id, uploader) REFERENCES documents (file_id, uploader) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS document_chunks_embedding_cosine_idx ON document_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE chatbot_logs (
    log_id VARCHAR(255) NOT NULL, 
    session_id VARCHAR(255) NOT NULL, 
    question TEXT NOT NULL, 
    answer TEXT NOT NULL, 
    source VARCHAR(50) NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (log_id), 
    FOREIGN KEY(session_id) REFERENCES chat_sessions (session_id) ON DELETE CASCADE
);

INSERT INTO alembic_version (version_num) VALUES ('8df4d0461bc8') RETURNING alembic_version.version_num;

-- Running upgrade 8df4d0461bc8 -> c3f9a2d1b7e1

DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'task'
                  AND column_name = 'task_type'
            )
            AND NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'task'
                  AND column_name = 'product_category'
            ) THEN
                ALTER TABLE task RENAME COLUMN task_type TO product_category;
            END IF;
        END
        $$;;

ALTER TABLE IF EXISTS task
        ADD COLUMN IF NOT EXISTS product_category VARCHAR(255) NOT NULL DEFAULT '전체';;

UPDATE task
        SET product_category = '전체'
        WHERE product_category IS NULL OR btrim(product_category) = '';;

ALTER TABLE IF EXISTS task
        ALTER COLUMN product_category DROP DEFAULT;;

DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'documents'
            )
            AND NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'uq_documents_uploader_file_path'
            ) THEN
                ALTER TABLE documents
                ADD CONSTRAINT uq_documents_uploader_file_path
                UNIQUE (uploader, file_path);
            END IF;
        END
        $$;;

CREATE TABLE IF NOT EXISTS company_holidays (
            holiday_date DATE NOT NULL,
            holiday_name VARCHAR(255) NOT NULL,
            CONSTRAINT pk_company_holidays PRIMARY KEY (holiday_date)
        );;

CREATE TABLE IF NOT EXISTS equipment_maintenance (
            id SERIAL PRIMARY KEY,
            equipment_id VARCHAR(255) NOT NULL,
            pm_date DATE NOT NULL,
            start_slot INTEGER NOT NULL,
            end_slot INTEGER NOT NULL,
            CONSTRAINT fk_equipments_to_equipment_maintenance
            FOREIGN KEY (equipment_id)
            REFERENCES equipments (eq_id)
            ON DELETE CASCADE
        );;

UPDATE alembic_version SET version_num='c3f9a2d1b7e1' WHERE alembic_version.version_num = '8df4d0461bc8';

COMMIT;

