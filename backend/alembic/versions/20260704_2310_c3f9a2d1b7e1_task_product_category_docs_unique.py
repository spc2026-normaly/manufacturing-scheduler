"""task_product_category_docs_unique

Revision ID: c3f9a2d1b7e1
Revises: 8df4d0461bc8
Create Date: 2026-07-04 23:10:00.000000+00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3f9a2d1b7e1"
down_revision: Union[str, None] = "8df4d0461bc8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
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
        $$;
        """
    )

    op.execute(
        """
        ALTER TABLE IF EXISTS task
        ADD COLUMN IF NOT EXISTS product_category VARCHAR(255) NOT NULL DEFAULT '전체';
        """
    )

    op.execute(
        """
        UPDATE task
        SET product_category = '전체'
        WHERE product_category IS NULL OR btrim(product_category) = '';
        """
    )

    op.execute(
        """
        ALTER TABLE IF EXISTS task
        ALTER COLUMN product_category DROP DEFAULT;
        """
    )

    op.execute(
        """
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
        $$;
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS company_holidays (
            holiday_date DATE NOT NULL,
            holiday_name VARCHAR(255) NOT NULL,
            CONSTRAINT pk_company_holidays PRIMARY KEY (holiday_date)
        );
        """
    )

    op.execute(
        """
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
        );
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS equipment_maintenance;")
    op.execute("DROP TABLE IF EXISTS company_holidays;")
    op.execute(
        """
        ALTER TABLE IF EXISTS documents
        DROP CONSTRAINT IF EXISTS uq_documents_uploader_file_path;
        """
    )

    op.execute(
        """
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
        $$;
        """
    )
