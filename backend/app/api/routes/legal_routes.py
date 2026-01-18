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
    ProvenienteCreate,
    ProvenienteUpdate,
    ProvenienteResponse,
    TiposDocumentoCreate,
    TiposDocumentoUpdate,
    TiposDocumentoResponse,
    CategoriaDocumentoCreate,
    CategoriaDocumentoUpdate,
    CategoriaDocumentoResponse,
    PlantillaDocumentoCreate,
    PlantillaDocumentoUpdate,
    PlantillaDocumentoResponse,
)
from app.services.legal_service import (
    AreaService,
    EstadoSiniestroService,
    CalificacionSiniestroService,
    EntidadService,
    InstitucionService,
    AutoridadService,
    ProvenienteService,
    TiposDocumentoService,
    CategoriaDocumentoService,
    PlantillaDocumentoService,
)

router = APIRouter(prefix="/catalogos", tags=["Catálogos"])


# ===== ÁREAS =====
@router.get("/areas", response_model=List[AreaResponse])
def list_areas(
    activo: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return AreaService.list(db, current_user.empresa_id, activo)


@router.post("/areas", response_model=AreaResponse, status_code=status.HTTP_201_CREATED)
def create_area(
    payload: AreaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return AreaService.create(db, current_user.empresa_id, payload)


@router.put("/areas/{area_id}", response_model=AreaResponse)
def update_area(
    area_id: UUID,
    payload: AreaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    area = AreaService.update(db, area_id, payload)
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada")
    return area


@router.delete("/areas/{area_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_area(
    area_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ok = AreaService.delete(db, area_id)
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
    es = EstadoSiniestroService.update(db, estado_id, payload)
    if not es:
        raise HTTPException(status_code=404, detail="Estado de siniestro no encontrado")
    return es


@router.delete("/estados-siniestro/{estado_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_estado_siniestro(
    estado_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ok = EstadoSiniestroService.delete(db, estado_id)
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
    calificacion = CalificacionSiniestroService.update(db, calificacion_id, payload)
    if not calificacion:
        raise HTTPException(status_code=404, detail="Calificación no encontrada")
    return calificacion


@router.delete("/calificaciones-siniestro/{calificacion_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_calificacion_siniestro(
    calificacion_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ok = CalificacionSiniestroService.delete(db, calificacion_id)
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
    entidad = EntidadService.update(db, entidad_id, payload)
    if not entidad:
        raise HTTPException(status_code=404, detail="Entidad no encontrada")
    return entidad


@router.delete("/entidades/{entidad_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entidad(
    entidad_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ok = EntidadService.delete(db, entidad_id)
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
    inst = InstitucionService.update(db, institucion_id, payload)
    if not inst:
        raise HTTPException(status_code=404, detail="Institución no encontrada")
    return inst


@router.delete("/instituciones/{institucion_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_institucion(
    institucion_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ok = InstitucionService.delete(db, institucion_id)
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
    autoridad = AutoridadService.update(db, autoridad_id, payload)
    if not autoridad:
        raise HTTPException(status_code=404, detail="Autoridad no encontrada")
    return autoridad


@router.delete("/autoridades/{autoridad_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_autoridad(
    autoridad_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ok = AutoridadService.delete(db, autoridad_id)
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
    proveniente = ProvenienteService.update(db, proveniente_id, payload)
    if not proveniente:
        raise HTTPException(status_code=404, detail="Proveniente no encontrado")
    return proveniente


@router.delete("/provenientes/{proveniente_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_proveniente(
    proveniente_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ok = ProvenienteService.delete(db, proveniente_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Proveniente no encontrado")
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
    current_user: User = Depends(get_current_active_user),
):
    return TiposDocumentoService.list(db, activo, area_id)


@router.post("/tipos-documento", response_model=TiposDocumentoResponse, status_code=status.HTTP_201_CREATED)
def create_tipo_documento(
    payload: TiposDocumentoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return TiposDocumentoService.create(db, payload)


@router.put("/tipos-documento/{tipo_id}", response_model=TiposDocumentoResponse)
def update_tipo_documento(
    tipo_id: UUID,
    payload: TiposDocumentoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    td = TiposDocumentoService.update(db, tipo_id, payload)
    if not td:
        raise HTTPException(status_code=404, detail="Tipo de documento no encontrada")
    return td


@router.delete("/tipos-documento/{tipo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tipo_documento(
    tipo_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
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
    current_user: User = Depends(get_current_active_user),
):
    return CategoriaDocumentoService.list(db, tipo_documento_id, activo)


@router.post("/categorias-documento", response_model=CategoriaDocumentoResponse, status_code=status.HTTP_201_CREATED)
def create_categoria_documento(
    payload: CategoriaDocumentoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return CategoriaDocumentoService.create(db, payload)


@router.put("/categorias-documento/{categoria_id}", response_model=CategoriaDocumentoResponse)
def update_categoria_documento(
    categoria_id: UUID,
    payload: CategoriaDocumentoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    categoria = CategoriaDocumentoService.update(db, categoria_id, payload)
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return categoria


@router.delete("/categorias-documento/{categoria_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_categoria_documento(
    categoria_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
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
    current_user: User = Depends(get_current_active_user),
):
    return PlantillaDocumentoService.list(db, tipo_documento_id, categoria_id, activo)


@router.get("/plantillas-documento/{plantilla_id}", response_model=PlantillaDocumentoResponse)
def get_plantilla_documento(
    plantilla_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    plantilla = PlantillaDocumentoService.get_by_id(db, plantilla_id)
    if not plantilla:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return plantilla


@router.post("/plantillas-documento", response_model=PlantillaDocumentoResponse, status_code=status.HTTP_201_CREATED)
def create_plantilla_documento(
    payload: PlantillaDocumentoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return PlantillaDocumentoService.create(db, payload)


@router.put("/plantillas-documento/{plantilla_id}", response_model=PlantillaDocumentoResponse)
def update_plantilla_documento(
    plantilla_id: UUID,
    payload: PlantillaDocumentoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    plantilla = PlantillaDocumentoService.update(db, plantilla_id, payload)
    if not plantilla:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return plantilla


@router.delete("/plantillas-documento/{plantilla_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plantilla_documento(
    plantilla_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ok = PlantillaDocumentoService.delete(db, plantilla_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return None


