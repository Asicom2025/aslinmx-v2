"""Consultas de catálogo geográfico."""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.geo_models import GeoEstado, GeoMunicipio, GeoPais


class GeoCatalogService:
    @staticmethod
    def list_paises(db: Session, activo: Optional[bool] = True) -> List[GeoPais]:
        q = db.query(GeoPais)
        if activo is not None:
            q = q.filter(GeoPais.activo == activo)
        return q.order_by(GeoPais.nombre).all()

    @staticmethod
    def list_estados(
        db: Session,
        pais_id: UUID,
        activo: Optional[bool] = True,
    ) -> List[GeoEstado]:
        q = db.query(GeoEstado).filter(GeoEstado.pais_id == pais_id)
        if activo is not None:
            q = q.filter(GeoEstado.activo == activo)
        return q.order_by(GeoEstado.nombre).all()

    @staticmethod
    def list_municipios(
        db: Session,
        estado_id: UUID,
        q: Optional[str] = None,
        activo: Optional[bool] = True,
        limit: int = 200,
        offset: int = 0,
    ) -> List[GeoMunicipio]:
        query = db.query(GeoMunicipio).filter(GeoMunicipio.estado_id == estado_id)
        if activo is not None:
            query = query.filter(GeoMunicipio.activo == activo)
        if q and q.strip():
            term = f"%{q.strip()}%"
            query = query.filter(GeoMunicipio.nombre.ilike(term))
        return (
            query.order_by(func.lower(GeoMunicipio.nombre))
            .offset(max(0, offset))
            .limit(min(500, max(1, limit)))
            .all()
        )

    @staticmethod
    def get_pais_by_id(db: Session, pais_id: UUID) -> Optional[GeoPais]:
        return db.query(GeoPais).filter(GeoPais.id == pais_id).first()

    @staticmethod
    def get_estado_by_id(db: Session, estado_id: UUID) -> Optional[GeoEstado]:
        return db.query(GeoEstado).filter(GeoEstado.id == estado_id).first()

    @staticmethod
    def get_municipio_by_id(db: Session, municipio_id: UUID) -> Optional[GeoMunicipio]:
        return db.query(GeoMunicipio).filter(GeoMunicipio.id == municipio_id).first()
