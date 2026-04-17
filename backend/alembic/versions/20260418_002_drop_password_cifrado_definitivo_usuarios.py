"""Eliminar password_cifrado_definitivo de usuarios

Revision ID: 20260418_002
Revises: 20260418_001
Create Date: 2026-04-18
"""

from alembic import op
import sqlalchemy as sa


revision = "20260418_002"
down_revision = "20260418_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("usuarios")}
    if "password_cifrado_definitivo" in columns:
        op.drop_column("usuarios", "password_cifrado_definitivo")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("usuarios")}
    if "password_cifrado_definitivo" not in columns:
        op.add_column(
            "usuarios",
            sa.Column("password_cifrado_definitivo", sa.Text(), nullable=True),
        )
