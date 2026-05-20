"""Abogado principal de informes por área (siniestro_areas)

Revision ID: 20260424_001
Revises: 20260423_002
Create Date: 2026-04-24
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260424_001"
down_revision = "20260423_002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("siniestro_areas")}
    if "abogado_principal_informe_id" not in columns:
        op.add_column(
            "siniestro_areas",
            sa.Column(
                "abogado_principal_informe_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("usuarios.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )

    su_columns = {col["name"] for col in inspector.get_columns("siniestro_usuarios")}
    tipo_relacion_filter = (
        "AND su.tipo_relacion = 'tercero'"
        if "tipo_relacion" in su_columns
        else ""
    )

    # Herencia: un solo abogado principal por siniestro → misma firma en todas las filas de área.
    # En instalaciones donde `tipo_relacion` ya fue removida, todos los involucrados son abogados.
    op.execute(
        f"""
        UPDATE siniestro_areas sa
        SET abogado_principal_informe_id = su.usuario_id
        FROM siniestro_usuarios su
        WHERE su.siniestro_id = sa.siniestro_id
          {tipo_relacion_filter}
          AND su.es_principal IS TRUE
          AND su.activo IS TRUE
          AND su.eliminado IS FALSE
          AND sa.abogado_principal_informe_id IS NULL
          AND sa.eliminado IS FALSE
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("siniestro_areas")}
    if "abogado_principal_informe_id" in columns:
        op.drop_column("siniestro_areas", "abogado_principal_informe_id")
