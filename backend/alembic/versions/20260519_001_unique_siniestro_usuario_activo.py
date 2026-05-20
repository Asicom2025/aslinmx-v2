"""Evitar abogados duplicados por siniestro

Revision ID: 20260519_001
Revises: 20260425_001
Create Date: 2026-05-19
"""

from alembic import op


revision = "20260519_001"
down_revision = "20260425_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        WITH ranked AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY siniestro_id, usuario_id
                    ORDER BY activo DESC, es_principal DESC, creado_en ASC, id ASC
                ) AS rn
            FROM siniestro_usuarios
            WHERE eliminado = false
        )
        UPDATE siniestro_usuarios su
        SET
            eliminado = true,
            activo = false,
            eliminado_en = COALESCE(su.eliminado_en, now()),
            actualizado_en = now()
        FROM ranked
        WHERE su.id = ranked.id
          AND ranked.rn > 1
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_siniestro_usuarios_no_eliminado
        ON siniestro_usuarios (siniestro_id, usuario_id)
        WHERE eliminado = false
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_siniestro_usuarios_no_eliminado")
