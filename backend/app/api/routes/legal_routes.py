"""
Rutas API para catálogos legales
"""
import csv
import io
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.core.permisos import require_any_permiso
from app.models.user import User
from app.schemas.legal_schema import (
    AreaCreate,
    AreaUpdate,
    AreaResponse,
    EstadoSiniestroCreate,
    EstadoSiniestroUpdate,
    EstadoSiniestroResponse,
    CalificacionSiniestroCreate,
    CalificacionSiniestroUpdate,
    CalificacionSiniestroResponse,
    EntidadCreate,
    EntidadUpdate,
    EntidadResponse,
    InstitucionCreate,
    InstitucionUpdate,
    InstitucionResponse,
    AutoridadCreate,
    AutoridadUpdate,
    AutoridadResponse,
    AseguradoCreate,
    AseguradoUpdate,
    AseguradoResponse,
    ProvenienteCreate,
    ProvenienteUpdate,
    ProvenienteResponse,
    ProvenienteContactoCreate,
    ProvenienteContactoResponse,
    TiposDocumentoCreate,
    TiposDocumentoUpdate,
    TiposDocumentoResponse,
    CategoriaDocumentoCreate,
    CategoriaDocumentoUpdate,
    CategoriaDocumentoResponse,
    PlantillaDocumentoCreate,
    PlantillaDocumentoUpdate,
    PlantillaDocumentoResponse,
    RespuestaFormularioCreate,
    RespuestaFormularioUpdate,
    RespuestaFormularioResponse,
)
from app.services.auditoria_service import AuditoriaService
from app.models.legal import Siniestro, Proveniente, ProvenienteContacto
from app.schemas.geo_schema import (
    GeoPaisResponse,
    GeoEstadoResponse,
    GeoMunicipioResponse,
    GooglePlaceDetailsResponse,
)
from app.services.geo_catalog_service import GeoCatalogService
from app.services.google_places_service import (
    fetch_place_details,
    google_maps_server_key_configured,
    normalized_fields_from_details,
)
from app.services.legal_service import (
    RespuestaFormularioService,
    AreaService,
    EstadoSiniestroService,
    CalificacionSiniestroService,
    EntidadService,
    InstitucionService,
    AutoridadService,
    AseguradoService,
    asegurado_to_response,
    asegurados_to_responses,
    ProvenienteService,
    ProvenienteContactoService,
    TiposDocumentoService,
    CategoriaDocumentoService,
    PlantillaDocumentoService,
)

router = APIRouter(prefix="/catalogos", tags=["Catálogos"])

_dep_area_read = Depends(
    require_any_permiso(
        ("configuracion", "read"),
        ("parametros", "read"),
        ("configuracion", "ver_areas"),
        ("siniestros", "read"),
    )
)
_dep_area_create = Depends(
    require_any_permiso(
        ("configuracion", "create"),
        ("parametros", "create"),
        ("configuracion", "editar_areas"),
    )
)
_dep_area_update = Depends(
    require_any_permiso(
        ("configuracion", "update"),
        ("parametros", "update"),
        ("configuracion", "editar_areas"),
    )
)
_dep_area_delete = Depends(
    require_any_permiso(
        ("configuracion", "delete"),
        ("parametros", "delete"),
        ("configuracion", "eliminar_areas"),
    )
)

_dep_catdoc_read = Depends(
    require_any_permiso(
        ("configuracion", "read"),
        ("parametros", "read"),
        ("configuracion", "ver_tipos_de_documentos"),
        ("siniestros", "read"),
    )
)
_dep_catdoc_create = Depends(
    require_any_permiso(
        ("configuracion", "create"),
        ("parametros", "create"),
        ("configuracion", "editar_tipos_de_documentos"),
        ("siniestros", "create"),
        ("siniestros", "subir_archivo"),
    )
)
_dep_catdoc_update = Depends(
    require_any_permiso(
        ("configuracion", "update"),
        ("parametros", "update"),
        ("configuracion", "editar_tipos_de_documentos"),
        ("siniestros", "update"),
    )
)
_dep_catdoc_delete = Depends(
    require_any_permiso(
        ("configuracion", "delete"),
        ("parametros", "delete"),
        ("configuracion", "eliminar_tipos_de_documentos"),
    )
)


def _area_to_response(area) -> AreaResponse:
    """Construye AreaResponse incluyendo jefe_nombre si el área tiene jefe."""
    data = {
        "id": area.id,
        "empresa_id": area.empresa_id,
        "usuario_id": getattr(area, "usuario_id", None),
        "nombre": area.nombre,
        "descripcion": area.descripcion,
        "codigo": area.codigo,
        "activo": area.activo,
        "creado_en": area.creado_en,
        "actualizado_en": area.actualizado_en,
        "eliminado_en": getattr(area, "eliminado_en", None),
        "jefe_nombre": None,
    }
    if getattr(area, "jefe", None):
        jefe = area.jefe
        data["jefe_nombre"] = getattr(jefe, "full_name", None) or getattr(jefe, "email", None) or str(jefe.id)
    return AreaResponse(**data)


# ===== ÁREAS =====
@router.get("/areas", response_model=List[AreaResponse])
def list_areas(
    activo: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = _dep_area_read,
):
    areas = AreaService.list(db, current_user.empresa_id, activo)
    return [_area_to_response(a) for a in areas]


@router.post("/areas", response_model=AreaResponse, status_code=status.HTTP_201_CREATED)
def create_area(
    payload: AreaCreate,
    db: Session = Depends(get_db),
    current_user: User = _dep_area_create,
):
    area = AreaService.create(db, current_user.empresa_id, payload)
    return _area_to_response(area)


@router.put("/areas/{area_id}", response_model=AreaResponse)
def update_area(
    area_id: UUID,
    payload: AreaUpdate,
    db: Session = Depends(get_db),
    current_user: User = _dep_area_update,
):
    area = AreaService.update(db, area_id, current_user.empresa_id, payload)
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada")
    return _area_to_response(area)


@router.delete("/areas/{area_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_area(
    area_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = _dep_area_delete,
):
    ok = AreaService.delete(db, area_id, current_user.empresa_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Área no encontrada")
    return None



# ===== ESTADOS DE SINIESTRO =====
@router.get("/estados-siniestro", response_model=List[EstadoSiniestroResponse])
def list_estados_siniestro(
    activo: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return EstadoSiniestroService.list(db, current_user.empresa_id, activo)


@router.post("/estados-siniestro", response_model=EstadoSiniestroResponse, status_code=status.HTTP_201_CREATED)
def create_estado_siniestro(
    payload: EstadoSiniestroCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return EstadoSiniestroService.create(db, current_user.empresa_id, payload)


@router.put("/estados-siniestro/{estado_id}", response_model=EstadoSiniestroResponse)
def update_estado_siniestro(
    estado_id: UUID,
    payload: EstadoSiniestroUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    es = EstadoSiniestroService.update(db, estado_id, current_user.empresa_id, payload)
    if not es:
        raise HTTPException(status_code=404, detail="Estado de siniestro no encontrado")
    return es


@router.delete("/estados-siniestro/{estado_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_estado_siniestro(
    estado_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ok = EstadoSiniestroService.delete(db, estado_id, current_user.empresa_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Estado de siniestro no encontrado")
    return None


# ===== CALIFICACIONES DE SINIESTRO =====
@router.get("/calificaciones-siniestro", response_model=List[CalificacionSiniestroResponse])
def list_calificaciones_siniestro(
    activo: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return CalificacionSiniestroService.list(db, current_user.empresa_id, activo)


@router.post("/calificaciones-siniestro", response_model=CalificacionSiniestroResponse, status_code=status.HTTP_201_CREATED)
def create_calificacion_siniestro(
    payload: CalificacionSiniestroCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return CalificacionSiniestroService.create(db, current_user.empresa_id, payload)


@router.put("/calificaciones-siniestro/{calificacion_id}", response_model=CalificacionSiniestroResponse)
def update_calificacion_siniestro(
    calificacion_id: UUID,
    payload: CalificacionSiniestroUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    calificacion = CalificacionSiniestroService.update(
        db,
        calificacion_id,
        current_user.empresa_id,
        payload,
    )
    if not calificacion:
        raise HTTPException(status_code=404, detail="Calificación no encontrada")
    return calificacion


@router.delete("/calificaciones-siniestro/{calificacion_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_calificacion_siniestro(
    calificacion_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ok = CalificacionSiniestroService.delete(db, calificacion_id, current_user.empresa_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Calificación no encontrada")
    return None


# ===== ENTIDADES =====
@router.get("/entidades", response_model=List[EntidadResponse])
def list_entidades(
    activo: Optional[bool] = Query(None),
    es_institucion: Optional[bool] = Query(None),
    es_autoridad: Optional[bool] = Query(None),
    es_organo: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return EntidadService.list(
        db,
        current_user.empresa_id,
        activo,
        es_institucion,
        es_autoridad,
        es_organo,
    )


@router.post("/entidades", response_model=EntidadResponse, status_code=status.HTTP_201_CREATED)
def create_entidad(
    payload: EntidadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return EntidadService.create(db, current_user.empresa_id, payload)


@router.put("/entidades/{entidad_id}", response_model=EntidadResponse)
def update_entidad(
    entidad_id: UUID,
    payload: EntidadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    entidad = EntidadService.update(db, entidad_id, current_user.empresa_id, payload)
    if not entidad:
        raise HTTPException(status_code=404, detail="Entidad no encontrada")
    return entidad


@router.delete("/entidades/{entidad_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entidad(
    entidad_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ok = EntidadService.delete(db, entidad_id, current_user.empresa_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Entidad no encontrada")
    return None


@router.get("/entidades/template-csv")
def download_entidades_template():
    """Descarga un template CSV para importación masiva de entidades"""
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Encabezados
    writer.writerow(["nombre", "codigo", "email", "telefono", "direccion", "contacto_principal", "observaciones", "es_institucion", "es_autoridad", "es_organo", "activo"])
    # Ejemplo de fila
    writer.writerow(["Ejemplo Entidad", "ENT001", "ejemplo@entidad.com", "5551234567", "Calle Ejemplo 123", "Juan Pérez", "Observaciones", "true", "false", "false", "true"])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=template_entidades.csv"}
    )


@router.post("/entidades/importar-csv")
async def importar_entidades_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Importa entidades desde un archivo CSV"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="El archivo debe ser CSV")
    
    content = await file.read()
    content_str = content.decode('utf-8-sig')
    csv_reader = csv.DictReader(io.StringIO(content_str))
    
    creadas = 0
    errores = []
    
    for idx, row in enumerate(csv_reader, start=2):
        try:
            nombre = row.get('nombre', '').strip()
            if not nombre:
                errores.append(f"Fila {idx}: Nombre es requerido")
                continue
            
            es_institucion = row.get('es_institucion', 'false').strip().lower() == 'true'
            es_autoridad = row.get('es_autoridad', 'false').strip().lower() == 'true'
            es_organo = row.get('es_organo', 'false').strip().lower() == 'true'
            
            if not (es_institucion or es_autoridad or es_organo):
                errores.append(f"Fila {idx}: La entidad debe tener al menos un rol (es_institucion, es_autoridad o es_organo)")
                continue
            
            payload = EntidadCreate(
                nombre=nombre,
                codigo=row.get('codigo', '').strip() or None,
                email=row.get('email', '').strip() or None,
                telefono=row.get('telefono', '').strip() or None,
                direccion=row.get('direccion', '').strip() or None,
                contacto_principal=row.get('contacto_principal', '').strip() or None,
                observaciones=row.get('observaciones', '').strip() or None,
                es_institucion=es_institucion,
                es_autoridad=es_autoridad,
                es_organo=es_organo,
                activo=row.get('activo', 'true').strip().lower() == 'true'
            )
            
            EntidadService.create(db, current_user.empresa_id, payload)
            creadas += 1
        except Exception as e:
            errores.append(f"Fila {idx}: {str(e)}")
    
    return {
        "mensaje": f"Importación completada: {creadas} entidades creadas",
        "creadas": creadas,
        "errores": errores if errores else None
    }


# ===== INSTITUCIONES =====
@router.get("/instituciones", response_model=List[InstitucionResponse])
def list_instituciones(
    activo: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return InstitucionService.list(db, current_user.empresa_id, activo)


@router.post("/instituciones", response_model=InstitucionResponse, status_code=status.HTTP_201_CREATED)
def create_institucion(
    payload: InstitucionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return InstitucionService.create(db, current_user.empresa_id, payload)


@router.put("/instituciones/{institucion_id}", response_model=InstitucionResponse)
def update_institucion(
    institucion_id: UUID,
    payload: InstitucionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    inst = InstitucionService.update(db, institucion_id, current_user.empresa_id, payload)
    if not inst:
        raise HTTPException(status_code=404, detail="Institución no encontrada")
    return inst


@router.delete("/instituciones/{institucion_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_institucion(
    institucion_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ok = InstitucionService.delete(db, institucion_id, current_user.empresa_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Institución no encontrada")
    return None


@router.get("/instituciones/template-csv")
def download_instituciones_template():
    """Descarga un template CSV para importación masiva de instituciones"""
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Encabezados
    writer.writerow(["nombre", "codigo", "email", "activo"])
    # Ejemplo de fila
    writer.writerow(["Ejemplo Institución", "INST001", "ejemplo@institucion.com", "true"])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=template_instituciones.csv"}
    )


@router.post("/instituciones/importar-csv")
async def importar_instituciones_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Importa instituciones desde un archivo CSV"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="El archivo debe ser CSV")
    
    content = await file.read()
    content_str = content.decode('utf-8-sig')  # Manejar BOM si existe
    csv_reader = csv.DictReader(io.StringIO(content_str))
    
    creadas = 0
    errores = []
    
    for idx, row in enumerate(csv_reader, start=2):  # start=2 porque la fila 1 es el header
        try:
            nombre = row.get('nombre', '').strip()
            if not nombre:
                errores.append(f"Fila {idx}: Nombre es requerido")
                continue
            
            payload = InstitucionCreate(
                nombre=nombre,
                codigo=row.get('codigo', '').strip() or None,
                email=row.get('email', '').strip() or None,
                activo=row.get('activo', 'true').strip().lower() == 'true'
            )
            
            InstitucionService.create(db, current_user.empresa_id, payload)
            creadas += 1
        except Exception as e:
            errores.append(f"Fila {idx}: {str(e)}")
    
    return {
        "mensaje": f"Importación completada: {creadas} instituciones creadas",
        "creadas": creadas,
        "errores": errores if errores else None
    }


# ===== AUTORIDADES =====
@router.get("/autoridades", response_model=List[AutoridadResponse])
def list_autoridades(
    activo: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return AutoridadService.list(db, current_user.empresa_id, activo)


@router.post("/autoridades", response_model=AutoridadResponse, status_code=status.HTTP_201_CREATED)
def create_autoridad(
    payload: AutoridadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return AutoridadService.create(db, current_user.empresa_id, payload)


@router.put("/autoridades/{autoridad_id}", response_model=AutoridadResponse)
def update_autoridad(
    autoridad_id: UUID,
    payload: AutoridadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    autoridad = AutoridadService.update(
        db,
        autoridad_id,
        current_user.empresa_id,
        payload,
    )
    if not autoridad:
        raise HTTPException(status_code=404, detail="Autoridad no encontrada")
    return autoridad


@router.delete("/autoridades/{autoridad_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_autoridad(
    autoridad_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ok = AutoridadService.delete(db, autoridad_id, current_user.empresa_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Autoridad no encontrada")
    return None


@router.get("/autoridades/template-csv")
def download_autoridades_template():
    """Descarga un template CSV para importación masiva de autoridades"""
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Encabezados
    writer.writerow(["nombre", "codigo", "email", "activo"])
    # Ejemplo de fila
    writer.writerow(["Ejemplo Autoridad", "AUT001", "ejemplo@autoridad.com", "true"])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=template_autoridades.csv"}
    )


@router.post("/autoridades/importar-csv")
async def importar_autoridades_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Importa autoridades desde un archivo CSV"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="El archivo debe ser CSV")
    
    content = await file.read()
    content_str = content.decode('utf-8-sig')
    csv_reader = csv.DictReader(io.StringIO(content_str))
    
    creadas = 0
    errores = []
    
    for idx, row in enumerate(csv_reader, start=2):
        try:
            nombre = row.get('nombre', '').strip()
            if not nombre:
                errores.append(f"Fila {idx}: Nombre es requerido")
                continue
            
            payload = AutoridadCreate(
                nombre=nombre,
                codigo=row.get('codigo', '').strip() or None,
                email=row.get('email', '').strip() or None,
                activo=row.get('activo', 'true').strip().lower() == 'true'
            )
            
            AutoridadService.create(db, current_user.empresa_id, payload)
            creadas += 1
        except Exception as e:
            errores.append(f"Fila {idx}: {str(e)}")
    
    return {
        "mensaje": f"Importación completada: {creadas} autoridades creadas",
        "creadas": creadas,
        "errores": errores if errores else None
    }


# ===== CATÁLOGO GEO (país → estado → municipio) =====
@router.get("/geo/paises", response_model=List[GeoPaisResponse])
def list_geo_paises(
    activo: Optional[bool] = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return GeoCatalogService.list_paises(db, activo=activo)


@router.get("/geo/estados", response_model=List[GeoEstadoResponse])
def list_geo_estados(
    pais_id: UUID = Query(..., description="ID del país (ej. México)"),
    activo: Optional[bool] = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return GeoCatalogService.list_estados(db, pais_id, activo=activo)


@router.get("/geo/municipios", response_model=List[GeoMunicipioResponse])
def list_geo_municipios(
    estado_id: UUID = Query(..., description="ID del estado federativo"),
    q: Optional[str] = Query(None, description="Búsqueda por nombre (ILIKE)"),
    activo: Optional[bool] = Query(True),
    limit: int = Query(500, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return GeoCatalogService.list_municipios(
        db, estado_id, q=q, activo=activo, limit=limit, offset=offset
    )


@router.get("/geo/places/details", response_model=GooglePlaceDetailsResponse)
def geo_place_details(
    place_id: str = Query(..., min_length=1, max_length=256),
    current_user: User = Depends(get_current_active_user),
):
    """Normalización opcional vía Places Details (requiere GOOGLE_MAPS_API_KEY en servidor)."""
    if not google_maps_server_key_configured():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Places en servidor no está configurado (GOOGLE_MAPS_API_KEY).",
        )
    result = fetch_place_details(place_id.strip())
    if not result:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail="No se pudo obtener el lugar desde Google.",
        )
    nf = normalized_fields_from_details(result)
    loc = (result.get("geometry") or {}).get("location") or {}
    return GooglePlaceDetailsResponse(
        place_id=place_id.strip(),
        formatted_address=nf.get("direccion") or result.get("formatted_address"),
        latitud=nf.get("latitud") if nf.get("latitud") is not None else loc.get("lat"),
        longitud=nf.get("longitud") if nf.get("longitud") is not None else loc.get("lng"),
        raw_types=result.get("types"),
    )


# ===== ASEGURADOS =====
@router.get("/asegurados", response_model=List[AseguradoResponse])
def list_asegurados(
    activo: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    rows = AseguradoService.list(db, current_user.empresa_id, activo)
    return asegurados_to_responses(db, rows)


@router.get("/asegurados/{asegurado_id}", response_model=AseguradoResponse)
def get_asegurado(
    asegurado_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    asegurado = AseguradoService.get_by_id(db, asegurado_id, current_user.empresa_id)
    if not asegurado:
        raise HTTPException(status_code=404, detail="Asegurado no encontrado")
    return asegurado_to_response(db, asegurado)


@router.post("/asegurados", response_model=AseguradoResponse, status_code=status.HTTP_201_CREATED)
def create_asegurado(
    payload: AseguradoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    created = AseguradoService.create(db, current_user.empresa_id, payload)
    return asegurado_to_response(db, created)


@router.put("/asegurados/{asegurado_id}", response_model=AseguradoResponse)
def update_asegurado(
    asegurado_id: UUID,
    payload: AseguradoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    asegurado = AseguradoService.update(db, asegurado_id, payload)
    if not asegurado:
        raise HTTPException(status_code=404, detail="Asegurado no encontrado")
    return asegurado_to_response(db, asegurado)


@router.delete("/asegurados/{asegurado_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asegurado(
    asegurado_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ok = AseguradoService.delete(db, asegurado_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Asegurado no encontrado")


# ===== PROVENIENTES =====
@router.get("/provenientes", response_model=List[ProvenienteResponse])
def list_provenientes(
    activo: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return ProvenienteService.list(db, current_user.empresa_id, activo)


@router.post("/provenientes", response_model=ProvenienteResponse, status_code=status.HTTP_201_CREATED)
def create_proveniente(
    payload: ProvenienteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return ProvenienteService.create(db, current_user.empresa_id, payload)


@router.put("/provenientes/{proveniente_id}", response_model=ProvenienteResponse)
def update_proveniente(
    proveniente_id: UUID,
    payload: ProvenienteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    proveniente = ProvenienteService.update(
        db,
        proveniente_id,
        current_user.empresa_id,
        payload,
    )
    if not proveniente:
        raise HTTPException(status_code=404, detail="Proveniente no encontrado")
    return proveniente


@router.delete("/provenientes/{proveniente_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_proveniente(
    proveniente_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ok = ProvenienteService.delete(db, proveniente_id, current_user.empresa_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Proveniente no encontrado")
    return None


@router.get(
    "/provenientes/{proveniente_id}/contactos",
    response_model=List[ProvenienteContactoResponse],
)
def list_proveniente_contactos(
    proveniente_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    proveniente = db.query(Proveniente).filter(
        Proveniente.id == proveniente_id,
        Proveniente.empresa_id == current_user.empresa_id,
        Proveniente.eliminado_en.is_(None),
    ).first()
    if not proveniente:
        raise HTTPException(status_code=404, detail="Proveniente no encontrado")
    return ProvenienteContactoService.list(db, proveniente_id)


@router.post(
    "/provenientes/{proveniente_id}/contactos",
    response_model=ProvenienteContactoResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_proveniente_contacto(
    proveniente_id: UUID,
    payload: ProvenienteContactoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    proveniente = db.query(Proveniente).filter(
        Proveniente.id == proveniente_id,
        Proveniente.empresa_id == current_user.empresa_id,
        Proveniente.eliminado_en.is_(None),
    ).first()
    if not proveniente:
        raise HTTPException(status_code=404, detail="Proveniente no encontrado")
    return ProvenienteContactoService.create(db, proveniente_id, payload)


@router.delete(
    "/provenientes/{proveniente_id}/contactos/{contacto_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_proveniente_contacto(
    proveniente_id: UUID,
    contacto_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    proveniente = db.query(Proveniente).filter(
        Proveniente.id == proveniente_id,
        Proveniente.empresa_id == current_user.empresa_id,
        Proveniente.eliminado_en.is_(None),
    ).first()
    if not proveniente:
        raise HTTPException(status_code=404, detail="Proveniente no encontrado")
    contacto = db.query(ProvenienteContacto).filter(
        ProvenienteContacto.id == contacto_id,
        ProvenienteContacto.proveniente_id == proveniente_id,
        ProvenienteContacto.eliminado_en.is_(None),
    ).first()
    if not contacto:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    ok = ProvenienteContactoService.delete(db, contacto_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    return None


@router.get("/provenientes/template-csv")
def download_provenientes_template():
    """Descarga un template CSV para importación masiva de provenientes"""
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Encabezados
    writer.writerow(["nombre", "codigo", "telefono", "email", "direccion", "contacto_principal", "observaciones", "activo"])
    # Ejemplo de fila
    writer.writerow(["Ejemplo Proveniente", "PROV001", "5551234567", "ejemplo@proveniente.com", "Calle Ejemplo 123", "Juan Pérez", "Observaciones", "true"])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=template_provenientes.csv"}
    )


@router.post("/provenientes/importar-csv")
async def importar_provenientes_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Importa provenientes desde un archivo CSV"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="El archivo debe ser CSV")
    
    content = await file.read()
    content_str = content.decode('utf-8-sig')
    csv_reader = csv.DictReader(io.StringIO(content_str))
    
    creadas = 0
    errores = []
    
    for idx, row in enumerate(csv_reader, start=2):
        try:
            nombre = row.get('nombre', '').strip()
            if not nombre:
                errores.append(f"Fila {idx}: Nombre es requerido")
                continue
            
            payload = ProvenienteCreate(
                nombre=nombre,
                codigo=row.get('codigo', '').strip() or None,
                telefono=row.get('telefono', '').strip() or None,
                email=row.get('email', '').strip() or None,
                direccion=row.get('direccion', '').strip() or None,
                contacto_principal=row.get('contacto_principal', '').strip() or None,
                observaciones=row.get('observaciones', '').strip() or None,
                activo=row.get('activo', 'true').strip().lower() == 'true'
            )
            
            ProvenienteService.create(db, current_user.empresa_id, payload)
            creadas += 1
        except Exception as e:
            errores.append(f"Fila {idx}: {str(e)}")
    
    return {
        "mensaje": f"Importación completada: {creadas} provenientes creados",
        "creadas": creadas,
        "errores": errores if errores else None
    }


# ===== TIPOS DE DOCUMENTO =====
@router.get("/tipos-documento", response_model=List[TiposDocumentoResponse])
def list_tipos_documento(
    activo: Optional[bool] = Query(None),
    area_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = _dep_catdoc_read,
):
    return TiposDocumentoService.list(db, activo, area_id)


@router.post("/tipos-documento", response_model=TiposDocumentoResponse, status_code=status.HTTP_201_CREATED)
def create_tipo_documento(
    payload: TiposDocumentoCreate,
    db: Session = Depends(get_db),
    current_user: User = _dep_catdoc_create,
):
    return TiposDocumentoService.create(db, payload)


@router.put("/tipos-documento/{tipo_id}", response_model=TiposDocumentoResponse)
def update_tipo_documento(
    tipo_id: UUID,
    payload: TiposDocumentoUpdate,
    db: Session = Depends(get_db),
    current_user: User = _dep_catdoc_update,
):
    td = TiposDocumentoService.update(db, tipo_id, payload)
    if not td:
        raise HTTPException(status_code=404, detail="Tipo de documento no encontrada")
    return td


@router.delete("/tipos-documento/{tipo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tipo_documento(
    tipo_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = _dep_catdoc_delete,
):
    ok = TiposDocumentoService.delete(db, tipo_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Tipo de documento no encontrada")
    return None


# ===== CATEGORÍAS DE DOCUMENTO =====
@router.get("/categorias-documento", response_model=List[CategoriaDocumentoResponse])
def list_categorias_documento(
    tipo_documento_id: Optional[UUID] = Query(None),
    activo: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = _dep_catdoc_read,
):
    return CategoriaDocumentoService.list(db, tipo_documento_id, activo)


@router.post("/categorias-documento", response_model=CategoriaDocumentoResponse, status_code=status.HTTP_201_CREATED)
def create_categoria_documento(
    payload: CategoriaDocumentoCreate,
    db: Session = Depends(get_db),
    current_user: User = _dep_catdoc_create,
):
    return CategoriaDocumentoService.create(db, payload)


@router.put("/categorias-documento/{categoria_id}", response_model=CategoriaDocumentoResponse)
def update_categoria_documento(
    categoria_id: UUID,
    payload: CategoriaDocumentoUpdate,
    db: Session = Depends(get_db),
    current_user: User = _dep_catdoc_update,
):
    categoria = CategoriaDocumentoService.update(db, categoria_id, payload)
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return categoria


@router.delete("/categorias-documento/{categoria_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_categoria_documento(
    categoria_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = _dep_catdoc_delete,
):
    ok = CategoriaDocumentoService.delete(db, categoria_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return None


# ===== PLANTILLAS DE DOCUMENTO =====
@router.get("/plantillas-documento", response_model=List[PlantillaDocumentoResponse])
def list_plantillas_documento(
    tipo_documento_id: Optional[UUID] = Query(None),
    categoria_id: Optional[UUID] = Query(None),
    activo: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = _dep_catdoc_read,
):
    return PlantillaDocumentoService.list(db, tipo_documento_id, categoria_id, activo)


@router.get("/plantillas-documento/{plantilla_id}", response_model=PlantillaDocumentoResponse)
def get_plantilla_documento(
    plantilla_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = _dep_catdoc_read,
):
    plantilla = PlantillaDocumentoService.get_by_id(db, plantilla_id)
    if not plantilla:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return plantilla


@router.post("/plantillas-documento", response_model=PlantillaDocumentoResponse, status_code=status.HTTP_201_CREATED)
def create_plantilla_documento(
    payload: PlantillaDocumentoCreate,
    db: Session = Depends(get_db),
    current_user: User = _dep_catdoc_create,
):
    return PlantillaDocumentoService.create(db, payload)


@router.put("/plantillas-documento/{plantilla_id}", response_model=PlantillaDocumentoResponse)
def update_plantilla_documento(
    plantilla_id: UUID,
    payload: PlantillaDocumentoUpdate,
    db: Session = Depends(get_db),
    current_user: User = _dep_catdoc_update,
):
    plantilla = PlantillaDocumentoService.update(db, plantilla_id, payload)
    if not plantilla:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return plantilla


@router.delete("/plantillas-documento/{plantilla_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plantilla_documento(
    plantilla_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = _dep_catdoc_delete,
):
    ok = PlantillaDocumentoService.delete(db, plantilla_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return None


# ===== RESPUESTAS FORMULARIO PLANTILLA =====
@router.get(
    "/plantillas-documento/{plantilla_id}/respuesta/{siniestro_id}",
    response_model=Optional[RespuestaFormularioResponse],
)
def get_respuesta_formulario(
    plantilla_id: UUID,
    siniestro_id: UUID,
    area_id: Optional[UUID] = Query(None, description="Área del siniestro para segmentar la respuesta"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Obtiene la respuesta de formulario para una plantilla+siniestro. Devuelve null si no existe."""
    return RespuestaFormularioService.get_or_none(db, plantilla_id, siniestro_id, area_id)


@router.put(
    "/plantillas-documento/{plantilla_id}/respuesta/{siniestro_id}",
    response_model=RespuestaFormularioResponse,
)
def upsert_respuesta_formulario(
    plantilla_id: UUID,
    siniestro_id: UUID,
    payload: RespuestaFormularioUpdate,
    area_id: Optional[UUID] = Query(None, description="Área del siniestro para separar respuestas por área"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Crea o actualiza la respuesta de formulario para una plantilla+siniestro+área."""
    resolved_area_id = payload.area_id if payload.area_id is not None else area_id
    respuesta = RespuestaFormularioService.upsert(
        db,
        plantilla_id=plantilla_id,
        siniestro_id=siniestro_id,
        area_id=resolved_area_id,
        valores=payload.valores,
        usuario_id=current_user.id,
    )
    # Auditoría: formulario actualizado
    siniestro_obj = db.query(Siniestro).filter(Siniestro.id == siniestro_id).first()
    empresa_id = siniestro_obj.empresa_id if siniestro_obj else current_user.empresa_id
    AuditoriaService.registrar_accion(
        db=db,
        usuario_id=current_user.id,
        empresa_id=empresa_id,
        accion="formulario_actualizado",
        modulo="siniestros",
        tabla="siniestros",
        registro_id=siniestro_id,
        descripcion=f"Respuesta de formulario actualizada (plantilla: {plantilla_id})",
        datos_nuevos={"plantilla_id": str(plantilla_id)},
    )
    return respuesta


@router.get(
    "/respuestas-formulario/siniestro/{siniestro_id}",
    response_model=List[RespuestaFormularioResponse],
)
def list_respuestas_by_siniestro(
    siniestro_id: UUID,
    area_id: Optional[UUID] = Query(None, description="Filtrar respuestas por área"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Lista todas las respuestas de formulario de un siniestro."""
    return RespuestaFormularioService.list_by_siniestro(db, siniestro_id, area_id)


