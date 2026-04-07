"""Agregar tabla archivos_generados

Revision ID: 20260402_002
Revises: 20260402_001
Create Date: 2026-04-02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260402_002"
down_revision = "20260402_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "archivos_generados" not in existing_tables:
        op.create_table(
            "archivos_generados",
            sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
            sa.Column("empresa_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("storage_object_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("tipo_origen", sa.String(length=50), nullable=False),
            sa.Column("modulo", sa.String(length=100), nullable=True),
            sa.Column("formato", sa.String(length=20), nullable=False),
            sa.Column("siniestro_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("plantilla_documento_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("generado_por", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("eliminado", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("creado_en", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("actualizado_en", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("eliminado_en", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["empresa_id"], ["empresas.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["generado_por"], ["usuarios.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["plantilla_documento_id"], ["plantillas_documento.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["siniestro_id"], ["siniestros.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["storage_object_id"], ["storage_objects.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    inspector = sa.inspect(bind)
    existing_indexes = {index["name"] for index in inspector.get_indexes("archivos_generados")}
    if "ix_archivos_generados_empresa_id" not in existing_indexes:
        op.create_index("ix_archivos_generados_empresa_id", "archivos_generados", ["empresa_id"])
    if "ix_archivos_generados_storage_object_id" not in existing_indexes:
        op.create_index("ix_archivos_generados_storage_object_id", "archivos_generados", ["storage_object_id"])
    if "ix_archivos_generados_tipo_origen" not in existing_indexes:
        op.create_index("ix_archivos_generados_tipo_origen", "archivos_generados", ["tipo_origen"])


def downgrade() -> None:
    op.drop_index("ix_archivos_generados_tipo_origen", table_name="archivos_generados")
    op.drop_index("ix_archivos_generados_storage_object_id", table_name="archivos_generados")
    op.drop_index("ix_archivos_generados_empresa_id", table_name="archivos_generados")
    op.drop_table("archivos_generados")
