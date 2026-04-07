"""Crear tabla siniestro_polizas y migrar datos desde siniestros

Revision ID: 20260330_001
Revises: 20250320_001
Create Date: 2026-03-30

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260330_001"
down_revision = "20250320_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "siniestro_polizas" not in existing_tables:
        op.create_table(
            "siniestro_polizas",
            sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
            sa.Column("siniestro_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("numero_poliza", sa.String(length=100), nullable=True),
            sa.Column("deducible", sa.Numeric(15, 2), nullable=False, server_default=sa.text("0.00")),
            sa.Column("reserva", sa.Numeric(15, 2), nullable=False, server_default=sa.text("0.00")),
            sa.Column("coaseguro", sa.Numeric(15, 2), nullable=False, server_default=sa.text("0.00")),
            sa.Column("suma_asegurada", sa.Numeric(15, 2), nullable=False, server_default=sa.text("0.00")),
            sa.Column("es_principal", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("orden", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("creado_en", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("actualizado_en", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.ForeignKeyConstraint(["siniestro_id"], ["siniestros.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    inspector = sa.inspect(bind)
    existing_indexes = {index["name"] for index in inspector.get_indexes("siniestro_polizas")}
    if "ix_siniestro_polizas_siniestro_id" not in existing_indexes:
        op.create_index("ix_siniestro_polizas_siniestro_id", "siniestro_polizas", ["siniestro_id"])
    if "ix_siniestro_polizas_siniestro_principal" not in existing_indexes:
        op.create_index(
            "ix_siniestro_polizas_siniestro_principal",
            "siniestro_polizas",
            ["siniestro_id", "es_principal", "orden"],
        )

    siniestro_columns = {column["name"] for column in inspector.get_columns("siniestros")}
    legacy_columns = {"numero_poliza", "deducible", "reserva", "coaseguro", "suma_asegurada"}
    if legacy_columns.issubset(siniestro_columns):
        op.execute(
            """
            INSERT INTO siniestro_polizas (
                id,
                siniestro_id,
                numero_poliza,
                deducible,
                reserva,
                coaseguro,
                suma_asegurada,
                es_principal,
                orden,
                creado_en,
                actualizado_en
            )
            SELECT
                gen_random_uuid(),
                s.id,
                NULLIF(BTRIM(s.numero_poliza), ''),
                COALESCE(s.deducible, 0.00),
                COALESCE(s.reserva, 0.00),
                COALESCE(s.coaseguro, 0.00),
                COALESCE(s.suma_asegurada, 0.00),
                TRUE,
                0,
                COALESCE(s.creado_en, now()),
                COALESCE(s.actualizado_en, now())
            FROM siniestros s
            WHERE
                (
                    NULLIF(BTRIM(s.numero_poliza), '') IS NOT NULL
                    OR COALESCE(s.deducible, 0.00) <> 0.00
                    OR COALESCE(s.reserva, 0.00) <> 0.00
                    OR COALESCE(s.coaseguro, 0.00) <> 0.00
                    OR COALESCE(s.suma_asegurada, 0.00) <> 0.00
                )
                AND NOT EXISTS (
                SELECT 1
                FROM siniestro_polizas sp
                WHERE sp.siniestro_id = s.id
            )
            """
        )

        op.drop_column("siniestros", "numero_poliza")
        op.drop_column("siniestros", "deducible")
        op.drop_column("siniestros", "reserva")
        op.drop_column("siniestros", "coaseguro")
        op.drop_column("siniestros", "suma_asegurada")


def downgrade() -> None:
    op.add_column("siniestros", sa.Column("suma_asegurada", sa.Numeric(15, 2), nullable=True))
    op.add_column("siniestros", sa.Column("coaseguro", sa.Numeric(15, 2), nullable=True))
    op.add_column("siniestros", sa.Column("reserva", sa.Numeric(15, 2), nullable=True))
    op.add_column("siniestros", sa.Column("deducible", sa.Numeric(15, 2), nullable=True))
    op.add_column("siniestros", sa.Column("numero_poliza", sa.String(length=100), nullable=True))

    op.execute(
        """
        WITH poliza_principal AS (
            SELECT DISTINCT ON (sp.siniestro_id)
                sp.siniestro_id,
                sp.numero_poliza,
                sp.deducible,
                sp.reserva,
                sp.coaseguro,
                sp.suma_asegurada
            FROM siniestro_polizas sp
            ORDER BY sp.siniestro_id, sp.es_principal DESC, sp.orden ASC, sp.creado_en ASC
        )
        UPDATE siniestros s
        SET
            numero_poliza = pp.numero_poliza,
            deducible = pp.deducible,
            reserva = pp.reserva,
            coaseguro = pp.coaseguro,
            suma_asegurada = pp.suma_asegurada
        FROM poliza_principal pp
        WHERE pp.siniestro_id = s.id
        """
    )

    op.drop_index("ix_siniestro_polizas_siniestro_principal", table_name="siniestro_polizas")
    op.drop_index("ix_siniestro_polizas_siniestro_id", table_name="siniestro_polizas")
    op.drop_table("siniestro_polizas")
