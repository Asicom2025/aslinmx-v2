"""Columnas datos específicos en siniestros

Revision ID: 20260422_001
Revises: 20260418_002
Create Date: 2026-04-22
"""

from alembic import op
import sqlalchemy as sa


revision = "20260422_001"
down_revision = "20260418_002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("siniestros")}
    if "tipo_intervencion" not in columns:
        op.add_column("siniestros", sa.Column("tipo_intervencion", sa.Text(), nullable=True))
    if "tercero" not in columns:
        op.add_column("siniestros", sa.Column("tercero", sa.Text(), nullable=True))
    if "nicho" not in columns:
        op.add_column("siniestros", sa.Column("nicho", sa.String(length=200), nullable=True))
    if "materia" not in columns:
        op.add_column("siniestros", sa.Column("materia", sa.String(length=200), nullable=True))
    if "expediente" not in columns:
        op.add_column("siniestros", sa.Column("expediente", sa.String(length=200), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("siniestros")}
    if "expediente" in columns:
        op.drop_column("siniestros", "expediente")
    if "materia" in columns:
        op.drop_column("siniestros", "materia")
    if "nicho" in columns:
        op.drop_column("siniestros", "nicho")
    if "tercero" in columns:
        op.drop_column("siniestros", "tercero")
    if "tipo_intervencion" in columns:
        op.drop_column("siniestros", "tipo_intervencion")
