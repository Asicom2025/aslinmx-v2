"""Agregar autorizacion de documentos por plantilla

Revision ID: 20260624_001
Revises: 20260519_001
Create Date: 2026-06-24
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260624_001"
down_revision = "20260519_001"
branch_labels = None
depends_on = None


def _column_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {col["name"] for col in inspector.get_columns(table_name)}


def upgrade() -> None:
    plantillas_cols = _column_names("plantillas_documento")
    if "requiere_autorizacion" not in plantillas_cols:
        op.add_column(
            "plantillas_documento",
            sa.Column(
                "requiere_autorizacion",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )

    documentos_cols = _column_names("documentos")
    if "requiere_autorizacion" not in documentos_cols:
        op.add_column(
            "documentos",
            sa.Column(
                "requiere_autorizacion",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )
    if "autorizado" not in documentos_cols:
        op.add_column(
            "documentos",
            sa.Column(
                "autorizado",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )
    if "autorizado_por" not in documentos_cols:
        op.add_column(
            "documentos",
            sa.Column("autorizado_por", postgresql.UUID(as_uuid=True), nullable=True),
        )
        op.create_foreign_key(
            "fk_documentos_autorizado_por_usuarios",
            "documentos",
            "usuarios",
            ["autorizado_por"],
            ["id"],
            ondelete="SET NULL",
        )
    if "autorizado_nombre" not in documentos_cols:
        op.add_column("documentos", sa.Column("autorizado_nombre", sa.String(length=255), nullable=True))
    if "autorizado_firma" not in documentos_cols:
        op.add_column("documentos", sa.Column("autorizado_firma", sa.Text(), nullable=True))
    if "autorizado_en" not in documentos_cols:
        op.add_column("documentos", sa.Column("autorizado_en", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    documentos_cols = _column_names("documentos")
    if "autorizado_en" in documentos_cols:
        op.drop_column("documentos", "autorizado_en")
    if "autorizado_firma" in documentos_cols:
        op.drop_column("documentos", "autorizado_firma")
    if "autorizado_nombre" in documentos_cols:
        op.drop_column("documentos", "autorizado_nombre")
    if "autorizado_por" in documentos_cols:
        op.drop_constraint("fk_documentos_autorizado_por_usuarios", "documentos", type_="foreignkey")
        op.drop_column("documentos", "autorizado_por")
    if "autorizado" in documentos_cols:
        op.drop_column("documentos", "autorizado")
    if "requiere_autorizacion" in documentos_cols:
        op.drop_column("documentos", "requiere_autorizacion")

    plantillas_cols = _column_names("plantillas_documento")
    if "requiere_autorizacion" in plantillas_cols:
        op.drop_column("plantillas_documento", "requiere_autorizacion")
