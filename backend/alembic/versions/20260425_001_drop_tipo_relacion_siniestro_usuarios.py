"""Eliminar tipo_relacion: involucrados son siempre abogados

Revision ID: 20260425_001
Revises: 20260424_001
Create Date: 2026-04-25
"""

from alembic import op
import sqlalchemy as sa


revision = "20260425_001"
down_revision = "20260424_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL: idempotente si la migración se re-ejecuta en entornos parciales
    op.execute(
        "ALTER TABLE siniestro_usuarios DROP CONSTRAINT IF EXISTS check_tipo_relacion"
    )
    op.execute("ALTER TABLE siniestro_usuarios DROP COLUMN IF EXISTS tipo_relacion")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "siniestro_usuarios" not in inspector.get_table_names():
        return
    columns = {col["name"] for col in inspector.get_columns("siniestro_usuarios")}
    if "tipo_relacion" in columns:
        return
    op.add_column(
        "siniestro_usuarios",
        sa.Column("tipo_relacion", sa.String(20), nullable=False, server_default="tercero"),
    )
    op.create_check_constraint(
        "check_tipo_relacion",
        "siniestro_usuarios",
        "tipo_relacion IN ('asegurado', 'proveniente', 'testigo', 'tercero')",
    )
    op.alter_column("siniestro_usuarios", "tipo_relacion", server_default=None)
