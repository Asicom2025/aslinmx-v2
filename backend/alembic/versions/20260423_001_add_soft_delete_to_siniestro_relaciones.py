"""Soft delete en relaciones de siniestro

Revision ID: 20260423_001
Revises: 20260422_001
Create Date: 2026-04-23
"""

from alembic import op
import sqlalchemy as sa


revision = "20260423_001"
down_revision = "20260422_001"
branch_labels = None
depends_on = None


def _add_columns_if_missing(table_name: str) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns(table_name)}

    if "eliminado" not in columns:
        op.add_column(
            table_name,
            sa.Column(
                "eliminado",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )
    if "eliminado_en" not in columns:
        op.add_column(
            table_name,
            sa.Column("eliminado_en", sa.DateTime(timezone=True), nullable=True),
        )


def _drop_columns_if_present(table_name: str) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns(table_name)}

    if "eliminado_en" in columns:
        op.drop_column(table_name, "eliminado_en")
    if "eliminado" in columns:
        op.drop_column(table_name, "eliminado")


def upgrade() -> None:
    _add_columns_if_missing("siniestro_areas")
    _add_columns_if_missing("siniestro_usuarios")


def downgrade() -> None:
    _drop_columns_if_present("siniestro_usuarios")
    _drop_columns_if_present("siniestro_areas")
