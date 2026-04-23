"""Columna eliminado_en en versiones_descripcion_hechos

Revision ID: 20260423_002
Revises: 20260423_001
Create Date: 2026-04-23
"""

from alembic import op
import sqlalchemy as sa


revision = "20260423_002"
down_revision = "20260423_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("versiones_descripcion_hechos")}
    if "eliminado_en" not in columns:
        op.add_column(
            "versiones_descripcion_hechos",
            sa.Column("eliminado_en", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("versiones_descripcion_hechos")}
    if "eliminado_en" in columns:
        op.drop_column("versiones_descripcion_hechos", "eliminado_en")
