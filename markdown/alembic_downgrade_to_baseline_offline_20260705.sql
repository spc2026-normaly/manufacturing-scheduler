BEGIN;

-- Running downgrade c3f9a2d1b7e1 -> 8df4d0461bc8

DROP TABLE IF EXISTS equipment_maintenance;;

DROP TABLE IF EXISTS company_holidays;;

ALTER TABLE IF EXISTS documents
        DROP CONSTRAINT IF EXISTS uq_documents_uploader_file_path;;

DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'task'
                  AND column_name = 'product_category'
            )
            AND NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'task'
                  AND column_name = 'task_type'
            ) THEN
                ALTER TABLE task RENAME COLUMN product_category TO task_type;
            END IF;
        END
        $$;;

UPDATE alembic_version SET version_num='8df4d0461bc8' WHERE alembic_version.version_num = 'c3f9a2d1b7e1';

COMMIT;

