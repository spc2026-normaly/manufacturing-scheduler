"""baseline_init

Revision ID: 8df4d0461bc8
Revises: 
Create Date: 2026-06-30 12:05:46.915926+00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


revision: str = '8df4d0461bc8'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        'employees',
        sa.Column('emp_id', sa.String(length=255), nullable=False),
        sa.Column('login_id', sa.String(length=255), nullable=False),
        sa.Column('login_pw', sa.String(length=255), nullable=False),
        sa.Column('emp_name', sa.String(length=255), nullable=False),
        sa.Column('emp_role', sa.String(length=50), nullable=False),
        sa.Column('emp_date', sa.Date(), nullable=False),
        sa.CheckConstraint("emp_role IN ('leader', 'member')", name='CK_EMPLOYEES_ROLE'),
        sa.PrimaryKeyConstraint('emp_id')
    )
    op.create_index(op.f('ix_employees_login_id'), 'employees', ['login_id'], unique=True)

    op.create_table(
        'orders',
        sa.Column('order_id', sa.String(length=255), nullable=False),
        sa.Column('order_num', sa.String(length=255), nullable=False),
        sa.Column('product_name', sa.String(length=255), nullable=False),
        sa.Column('order_count', sa.Integer(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column('order_status', sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint('order_id')
    )

    op.create_table(
        'task',
        sa.Column('task_id', sa.String(length=255), nullable=False),
        sa.Column('task_level', sa.String(length=50), nullable=False),
        sa.Column('task_name', sa.String(length=255), nullable=False),
        sa.Column('task_type', sa.String(length=100), nullable=False),
        sa.Column('task_factory', sa.String(length=255), nullable=True),
        sa.Column('task_time', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('task_id')
    )

    op.create_table(
        'equipments',
        sa.Column('eq_id', sa.String(length=255), nullable=False),
        sa.Column('eq_name', sa.String(length=255), nullable=False),
        sa.Column('eq_count', sa.Integer(), nullable=False),
        sa.Column('available_eq_count', sa.Integer(), nullable=False),
        sa.Column('check_cycle', sa.Integer(), nullable=False),
        sa.Column('eq_status', sa.String(length=50), nullable=False),
        sa.Column('check_date', sa.Date(), nullable=False),
        sa.Column('recent_check_date', sa.Date(), nullable=False),
        sa.Column('durability', sa.Integer(), nullable=False),
        sa.Column('rest_duration', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('eq_id')
    )

    op.create_table(
        'required_equipments',
        sa.Column('task_id', sa.String(length=255), nullable=False),
        sa.Column('eq_id', sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(['task_id'], ['task.task_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['eq_id'], ['equipments.eq_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('task_id', 'eq_id')
    )

    op.create_table(
        'schedules',
        sa.Column('id', sa.String(length=255), nullable=False),
        sa.Column('task_id', sa.String(length=255), nullable=False),
        sa.Column('order_id', sa.String(length=255), nullable=False),
        sa.Column('start_date', sa.DateTime(), nullable=False),
        sa.Column('end_date', sa.DateTime(), nullable=False),
        sa.Column('factory', sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(['task_id'], ['task.task_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['order_id'], ['orders.order_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', 'task_id', 'order_id')
    )

    op.create_table(
        'schedule_assignments',
        sa.Column('id', sa.String(length=255), nullable=False),
        sa.Column('user_id', sa.String(length=255), nullable=False),
        sa.Column('task_id', sa.String(length=255), nullable=False),
        sa.Column('order_id', sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(['id', 'task_id', 'order_id'], ['schedules.id', 'schedules.task_id', 'schedules.order_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['employees.emp_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', 'user_id', 'task_id', 'order_id')
    )

    op.create_table(
        'documents',
        sa.Column('file_id', sa.String(length=255), nullable=False),
        sa.Column('uploader', sa.String(length=255), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('file_size', sa.BigInteger(), nullable=False),
        sa.Column('file_extension', sa.String(length=50), nullable=False),
        sa.Column('file_path', sa.Text(), nullable=False),
        sa.Column('is_template', sa.Boolean(), nullable=False),
        sa.Column('file_created_at', sa.DateTime(), nullable=False),
        sa.Column('file_updated_at', sa.DateTime(), nullable=False),
        sa.Column('embedding_date', sa.DateTime(), nullable=False),
        sa.Column('embedding_status', sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(['uploader'], ['employees.emp_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('file_id', 'uploader')
    )

    op.create_table(
        'safety_training',
        sa.Column('training_id', sa.String(length=255), nullable=False),
        sa.Column('emp_id', sa.String(length=255), nullable=False),
        sa.Column('training_name', sa.String(length=255), nullable=False),
        sa.Column('training_date', sa.Date(), nullable=False),
        sa.Column('expired_date', sa.Date(), nullable=False),
        sa.Column('training_status', sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(['emp_id'], ['employees.emp_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('training_id', 'emp_id')
    )

    op.create_table(
        'safety_training_metadata',
        sa.Column('metadata_id', sa.String(length=255), nullable=False),
        sa.Column('training_names', sa.JSON(), nullable=False),
        sa.Column('updated_at', sa.Date(), nullable=False),
        sa.PrimaryKeyConstraint('metadata_id')
    )

    op.create_table(
        'token_usage_logs',
        sa.Column('id', sa.String(length=255), nullable=False),
        sa.Column('feature', sa.String(length=100), nullable=False),
        sa.Column('model_name', sa.String(length=100), nullable=False),
        sa.Column('prompt_tokens', sa.Integer(), nullable=False),
        sa.Column('completion_tokens', sa.Integer(), nullable=False),
        sa.Column('total_tokens', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'users',
        sa.Column('emp_id', sa.Integer(), nullable=False),
        sa.Column('emp_name', sa.String(length=50), nullable=False),
        sa.Column('login_id', sa.String(length=255), nullable=False),
        sa.Column('login_pw', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('emp_role', sa.String(length=30), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('emp_id')
    )
    op.create_index(op.f('ix_users_emp_id'), 'users', ['emp_id'], unique=False)
    op.create_index(op.f('ix_users_emp_name'), 'users', ['emp_name'], unique=True)

    op.create_table(
        'chat_sessions',
        sa.Column('session_id', sa.String(length=255), nullable=False),
        sa.Column('employee_id', sa.String(length=255), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_activity', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.emp_id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('session_id')
    )

    op.create_table(
        'document_chunks',
        sa.Column('chunk_id', sa.String(length=255), nullable=False),
        sa.Column('file_id', sa.String(length=255), nullable=False),
        sa.Column('uploader', sa.String(length=255), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('embedding', Vector(dim=1536), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['file_id', 'uploader'], ['documents.file_id', 'documents.uploader'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('chunk_id')
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS document_chunks_embedding_cosine_idx "
        "ON document_chunks USING hnsw (embedding vector_cosine_ops)"
    )

    op.create_table(
        'chatbot_logs',
        sa.Column('log_id', sa.String(length=255), nullable=False),
        sa.Column('session_id', sa.String(length=255), nullable=False),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('answer', sa.Text(), nullable=False),
        sa.Column('source', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['chat_sessions.session_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('log_id')
    )


def downgrade() -> None:
    op.drop_table('chatbot_logs')
    op.execute("DROP INDEX IF EXISTS document_chunks_embedding_cosine_idx")
    op.drop_table('document_chunks')
    op.drop_table('chat_sessions')
    op.drop_index(op.f('ix_users_emp_name'), table_name='users')
    op.drop_index(op.f('ix_users_emp_id'), table_name='users')
    op.drop_table('users')
    op.drop_table('token_usage_logs')
    op.drop_table('safety_training_metadata')
    op.drop_table('safety_training')
    op.drop_table('documents')
    op.drop_table('schedule_assignments')
    op.drop_table('schedules')
    op.drop_table('required_equipments')
    op.drop_table('equipments')
    op.drop_table('task')
    op.drop_table('orders')
    op.drop_index(op.f('ix_employees_login_id'), table_name='employees')
    op.drop_table('employees')
