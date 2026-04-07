"""Agregar tabla storage_objects y relacionarla con documentos

Revision ID: 20260402_001
Revises: 20260330_001
Create Date: 2026-04-02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260402_001"
down_revision = "20260330_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "storage_objects" not in existing_tables:
        op.create_table(
            "storage_objects",
            sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
            sa.Column("empresa_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("provider", sa.String(length=20), nullable=False),
            sa.Column("storage_path", sa.Text(), nullable=False),
            sa.Column("bucket_name", sa.String(length=255), nullable=True),
            sa.Column("object_key", sa.Text(), nullable=True),
            sa.Column("local_path", sa.Text(), nullable=True),
            sa.Column("original_filename", sa.String(length=255), nullable=False),
            sa.Column("mime_type", sa.String(length=100), nullable=True),
            sa.Column("size_bytes", sa.BigInteger(), nullable=True),
            sa.Column("etag", sa.String(length=255), nullable=True),
            sa.Column("sha256", sa.String(length=64), nullable=True),
            sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("creado_por", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("eliminado", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("creado_en", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("actualizado_en", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("eliminado_en", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["creado_por"], ["usuarios.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["empresa_id"], ["empresas.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("storage_path", name="uq_storage_objects_storage_path"),
        )

    inspector = sa.inspect(bind)
    existing_indexes = {index["name"] for index in inspector.get_indexes("storage_objects")}
    if "ix_storage_objects_empresa_id" not in existing_indexes:
        op.create_index("ix_storage_objects_empresa_id", "storage_objects", ["empresa_id"])
    if "ix_storage_objects_provider" not in existing_indexes:
        op.create_index("ix_storage_objects_provider", "storage_objects", ["provider"])

    document_columns = {column["name"] for column in inspector.get_columns("documentos")}
    if "storage_object_id" not in document_columns:
        op.add_column("documentos", sa.Column("storage_object_id", postgresql.UUID(as_uuid=True), nullable=True))

    existing_fks = {fk["name"] for fk in inspector.get_foreign_keys("documentos") if fk.get("name")}
    if "fk_documentos_storage_object_id" not in existing_fks:
        op.create_foreign_key(
            "fk_documentos_storage_object_id",
            "documentos",
            "storage_objects",
            ["storage_object_id"],
            ["id"],
            ondelete="SET NULL",
        )

    document_indexes = {index["name"] for index in inspector.get_indexes("documentos")}
    if "ix_documentos_storage_object_id" not in document_indexes:
        op.create_index("ix_documentos_storage_object_id", "documentos", ["storage_object_id"])

    op.execute(
        """
        INSERT INTO storage_objects (
            id,
            empresa_id,
            provider,
            storage_path,
            bucket_name,
            object_key,
            local_path,
            original_filename,
            mime_type,
            size_bytes,
            etag,
            sha256,
            metadata_json,
            creado_por,
            activo,
            eliminado,
            creado_en,
            actualizado_en,
            eliminado_en
        )
        SELECT
            gen_random_uuid(),
            s.empresa_id,
            CASE
                WHEN d.ruta_archivo LIKE 'r2://%' THEN 'r2'
                ELSE 'local'
            END,
            d.ruta_archivo,
            CASE
                WHEN d.ruta_archivo LIKE 'r2://%' THEN split_part(replace(d.ruta_archivo, 'r2://', ''), '/', 1)
                ELSE NULL
            END,
            CASE
                WHEN d.ruta_archivo LIKE 'r2://%'
                     AND position('/' in replace(d.ruta_archivo, 'r2://', '')) > 0
                THEN substr(
                    replace(d.ruta_archivo, 'r2://', ''),
                    position('/' in replace(d.ruta_archivo, 'r2://', '')) + 1
                )
                ELSE NULL
            END,
            CASE
                WHEN d.ruta_archivo LIKE 'r2://%' THEN NULL
                ELSE d.ruta_archivo
            END,
            COALESCE(NULLIF(BTRIM(d.nombre_archivo), ''), 'archivo'),
            d.tipo_mime,
            d."tamaño_archivo",
            NULL,
            NULL,
            '{}'::jsonb,
            d.usuario_subio,
            COALESCE(d.activo, true),
            COALESCE(d.eliminado, false),
            COALESCE(d.creado_en, now()),
            COALESCE(d.actualizado_en, COALESCE(d.creado_en, now())),
            d.eliminado_en
        FROM documentos d
        JOIN siniestros s ON s.id = d.siniestro_id
        WHERE d.ruta_archivo IS NOT NULL
          AND BTRIM(d.ruta_archivo) <> ''
        ON CONFLICT (storage_path) DO NOTHING
        """
    )

    op.execute(
        """
        UPDATE documentos d
        SET storage_object_id = so.id
        FROM storage_objects so
        WHERE d.storage_object_id IS NULL
          AND d.ruta_archivo IS NOT NULL
          AND BTRIM(d.ruta_archivo) <> ''
          AND so.storage_path = d.ruta_archivo
        """
    )


def downgrade() -> None:
    op.drop_index("ix_documentos_storage_object_id", table_name="documentos")
    op.drop_constraint("fk_documentos_storage_object_id", "documentos", type_="foreignkey")
    op.drop_column("documentos", "storage_object_id")

    op.drop_index("ix_storage_objects_provider", table_name="storage_objects")
    op.drop_index("ix_storage_objects_empresa_id", table_name="storage_objects")
    op.drop_table("storage_objects")
