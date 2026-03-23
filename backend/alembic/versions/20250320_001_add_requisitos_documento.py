"""Agregar tabla etapa_flujo_requisitos_documento y campo requisito_documento_id en documentos

Revision ID: 20250320_001
Revises:
Create Date: 2025-03-20

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20250320_001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "etapa_flujo_requisitos_documento",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("flujo_trabajo_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("etapa_flujo_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nombre_documento", sa.String(255), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("tipo_documento_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("categoria_documento_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("plantilla_documento_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("es_obligatorio", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("permite_upload", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("permite_generar", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("multiple", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("orden", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("clave", sa.String(100), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("actualizado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("eliminado_en", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["flujo_trabajo_id"], ["flujos_trabajo.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["etapa_flujo_id"], ["etapas_flujo.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tipo_documento_id"], ["tipos_documento.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["categoria_documento_id"], ["categorias_documento.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["plantilla_documento_id"], ["plantillas_documento.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_req_doc_etapa_flujo_id", "etapa_flujo_requisitos_documento", ["etapa_flujo_id"])
    op.create_index("ix_req_doc_flujo_trabajo_id", "etapa_flujo_requisitos_documento", ["flujo_trabajo_id"])
    op.create_index("ix_req_doc_clave", "etapa_flujo_requisitos_documento", ["clave"])

    op.add_column(
        "documentos",
        sa.Column(
            "requisito_documento_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("etapa_flujo_requisitos_documento.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("documentos", "requisito_documento_id")
    op.drop_index("ix_req_doc_clave", table_name="etapa_flujo_requisitos_documento")
    op.drop_index("ix_req_doc_flujo_trabajo_id", table_name="etapa_flujo_requisitos_documento")
    op.drop_index("ix_req_doc_etapa_flujo_id", table_name="etapa_flujo_requisitos_documento")
    op.drop_table("etapa_flujo_requisitos_documento")
