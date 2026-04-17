"""Agregar area_id a respuestas_formulario_plantilla

Revision ID: 20260417_001
Revises: 20260402_002
Create Date: 2026-04-17
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260417_001"
down_revision = "20260402_002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    columns = {col["name"] for col in inspector.get_columns("respuestas_formulario_plantilla")}
    if "area_id" not in columns:
        op.add_column(
            "respuestas_formulario_plantilla",
            sa.Column("area_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
        op.create_foreign_key(
            "fk_respuestas_formulario_plantilla_area_id",
            "respuestas_formulario_plantilla",
            "areas",
            ["area_id"],
            ["id"],
            ondelete="SET NULL",
        )

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("respuestas_formulario_plantilla")}
    if "ix_respuestas_formulario_siniestro_area_plantilla" not in existing_indexes:
        op.create_index(
            "ix_respuestas_formulario_siniestro_area_plantilla",
            "respuestas_formulario_plantilla",
            ["siniestro_id", "area_id", "plantilla_id"],
            unique=False,
        )


def downgrade() -> None:
    op.drop_index("ix_respuestas_formulario_siniestro_area_plantilla", table_name="respuestas_formulario_plantilla")
    op.drop_constraint(
        "fk_respuestas_formulario_plantilla_area_id",
        "respuestas_formulario_plantilla",
        type_="foreignkey",
    )
    op.drop_column("respuestas_formulario_plantilla", "area_id")

