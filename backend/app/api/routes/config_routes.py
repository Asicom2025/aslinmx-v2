"""
Rutas para configuración del sistema (SMTP, plantillas, etc.)
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.config import ConfiguracionSMTP, PlantillaCorreo, HistorialCorreo
from app.schemas.config_schema import (
    ConfiguracionSMTPCreate,
    ConfiguracionSMTPUpdate,
    ConfiguracionSMTPResponse,
    TestSMTPRequest,
    PlantillaCorreoCreate,
    PlantillaCorreoUpdate,
    PlantillaCorreoResponse,
    EnviarCorreoRequest,
    HistorialCorreoResponse,
    HistorialCorreoFiltros,
)
from app.services.email_service import EmailService
from app.services.auditoria_service import AuditoriaService

router = APIRouter()


# ========== Configuración SMTP ==========
@router.get("/smtp", response_model=List[ConfiguracionSMTPResponse])
async def listar_configuraciones_smtp(
    activo: bool = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lista todas las configuraciones SMTP de la empresa"""
    query = db.query(ConfiguracionSMTP).filter(
        ConfiguracionSMTP.empresa_id == current_user.empresa_id
    )
    if activo is not None:
        query = query.filter(ConfiguracionSMTP.activo == activo)
    return query.all()


@router.post("/smtp", response_model=ConfiguracionSMTPResponse, status_code=201)
async def crear_configuracion_smtp(
    config: ConfiguracionSMTPCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Crea una nueva configuración SMTP"""
    nueva_config = ConfiguracionSMTP(
        empresa_id=current_user.empresa_id,
        creado_por=current_user.id,
        **config.model_dump()
    )
    db.add(nueva_config)
    db.commit()
    db.refresh(nueva_config)

    # Registrar en auditoría
    AuditoriaService.registrar_accion(
        db=db,
        usuario_id=current_user.id,
        empresa_id=current_user.empresa_id,
        accion="CREATE",
        modulo="configuracion",
        tabla="configuracion_smtp",
        registro_id=nueva_config.id,
        datos_nuevos=config.model_dump(exclude={"password"}),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        descripcion=f"Configuración SMTP '{config.nombre}' creada"
    )

    return nueva_config


@router.get("/smtp/{config_id}", response_model=ConfiguracionSMTPResponse)
async def obtener_configuracion_smtp(
    config_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtiene una configuración SMTP específica"""
    config = db.query(ConfiguracionSMTP).filter(
        ConfiguracionSMTP.id == config_id,
        ConfiguracionSMTP.empresa_id == current_user.empresa_id
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuración SMTP no encontrada")
    return config


@router.put("/smtp/{config_id}", response_model=ConfiguracionSMTPResponse)
async def actualizar_configuracion_smtp(
    config_id: UUID,
    config_update: ConfiguracionSMTPUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Actualiza una configuración SMTP"""
    config = db.query(ConfiguracionSMTP).filter(
        ConfiguracionSMTP.id == config_id,
        ConfiguracionSMTP.empresa_id == current_user.empresa_id
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuración SMTP no encontrada")

    datos_anteriores = {
        "nombre": config.nombre,
        "servidor": config.servidor,
        "puerto": config.puerto,
        "usuario": config.usuario,
        "activo": config.activo
    }

    update_data = config_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)

    db.commit()
    db.refresh(config)

    # Registrar en auditoría
    AuditoriaService.registrar_accion(
        db=db,
        usuario_id=current_user.id,
        empresa_id=current_user.empresa_id,
        accion="UPDATE",
        modulo="configuracion",
        tabla="configuracion_smtp",
        registro_id=config.id,
        datos_anteriores=datos_anteriores,
        datos_nuevos=update_data,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        descripcion=f"Configuración SMTP '{config.nombre}' actualizada"
    )

    return config


@router.delete("/smtp/{config_id}", status_code=204)
async def eliminar_configuracion_smtp(
    config_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Elimina una configuración SMTP"""
    config = db.query(ConfiguracionSMTP).filter(
        ConfiguracionSMTP.id == config_id,
        ConfiguracionSMTP.empresa_id == current_user.empresa_id
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuración SMTP no encontrada")

    nombre = config.nombre
    db.delete(config)
    db.commit()

    # Registrar en auditoría
    AuditoriaService.registrar_accion(
        db=db,
        usuario_id=current_user.id,
        empresa_id=current_user.empresa_id,
        accion="DELETE",
        modulo="configuracion",
        tabla="configuracion_smtp",
        registro_id=config_id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        descripcion=f"Configuración SMTP '{nombre}' eliminada"
    )


@router.post("/smtp/{config_id}/test")
async def probar_configuracion_smtp(
    config_id: UUID,
    test_request: TestSMTPRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Prueba una configuración SMTP enviando un correo de prueba"""
    config = db.query(ConfiguracionSMTP).filter(
        ConfiguracionSMTP.id == config_id,
        ConfiguracionSMTP.empresa_id == current_user.empresa_id
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuración SMTP no encontrada")

    # Probar conexión
    success, error = EmailService.test_smtp_connection(config)
    if not success:
        raise HTTPException(status_code=400, detail=f"Error de conexión: {error}")

    # Enviar correo de prueba
    success, error = EmailService.send_email_sync(
        config=config,
        destinatarios=[test_request.destinatario],
        asunto=test_request.asunto,
        cuerpo_html=f"<p>{test_request.mensaje}</p>",
        cuerpo_texto=test_request.mensaje
    )

    if not success:
        raise HTTPException(status_code=400, detail=f"Error al enviar correo: {error}")

    # Guardar en historial
    EmailService.guardar_historial(
        db=db,
        empresa_id=str(current_user.empresa_id),
        configuracion_smtp_id=str(config_id),
        plantilla_id=None,
        destinatario=test_request.destinatario,
        asunto=test_request.asunto,
        cuerpo_html=f"<p>{test_request.mensaje}</p>",
        cuerpo_texto=test_request.mensaje,
        estado="enviado"
    )

    return {"success": True, "message": "Correo de prueba enviado exitosamente"}


# ========== Plantillas de Correo ==========
@router.get("/plantillas-correo", response_model=List[PlantillaCorreoResponse])
async def listar_plantillas_correo(
    activo: bool = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lista todas las plantillas de correo"""
    query = db.query(PlantillaCorreo).filter(
        PlantillaCorreo.empresa_id == current_user.empresa_id
    )
    if activo is not None:
        query = query.filter(PlantillaCorreo.activo == activo)
    return query.all()


@router.post("/plantillas-correo", response_model=PlantillaCorreoResponse, status_code=201)
async def crear_plantilla_correo(
    plantilla: PlantillaCorreoCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Crea una nueva plantilla de correo"""
    nueva_plantilla = PlantillaCorreo(
        empresa_id=current_user.empresa_id,
        **plantilla.model_dump()
    )
    db.add(nueva_plantilla)
    db.commit()
    db.refresh(nueva_plantilla)
    return nueva_plantilla


@router.get("/plantillas-correo/{plantilla_id}", response_model=PlantillaCorreoResponse)
async def obtener_plantilla_correo(
    plantilla_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtiene una plantilla de correo específica"""
    plantilla = db.query(PlantillaCorreo).filter(
        PlantillaCorreo.id == plantilla_id,
        PlantillaCorreo.empresa_id == current_user.empresa_id
    ).first()
    if not plantilla:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return plantilla


@router.put("/plantillas-correo/{plantilla_id}", response_model=PlantillaCorreoResponse)
async def actualizar_plantilla_correo(
    plantilla_id: UUID,
    plantilla_update: PlantillaCorreoUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Actualiza una plantilla de correo"""
    plantilla = db.query(PlantillaCorreo).filter(
        PlantillaCorreo.id == plantilla_id,
        PlantillaCorreo.empresa_id == current_user.empresa_id
    ).first()
    if not plantilla:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")

    update_data = plantilla_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(plantilla, field, value)

    db.commit()
    db.refresh(plantilla)
    return plantilla


@router.delete("/plantillas-correo/{plantilla_id}", status_code=204)
async def eliminar_plantilla_correo(
    plantilla_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Elimina una plantilla de correo"""
    plantilla = db.query(PlantillaCorreo).filter(
        PlantillaCorreo.id == plantilla_id,
        PlantillaCorreo.empresa_id == current_user.empresa_id
    ).first()
    if not plantilla:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")

    db.delete(plantilla)
    db.commit()


@router.post("/enviar-correo")
async def enviar_correo(
    request_data: EnviarCorreoRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Envía un correo electrónico usando una configuración SMTP y opcionalmente una plantilla"""
    # Obtener configuración SMTP
    config = db.query(ConfiguracionSMTP).filter(
        ConfiguracionSMTP.id == request_data.configuracion_smtp_id,
        ConfiguracionSMTP.empresa_id == current_user.empresa_id,
        ConfiguracionSMTP.activo == True
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuración SMTP no encontrada o inactiva")

    # Obtener plantilla si se especificó
    asunto = request_data.asunto
    cuerpo_html = request_data.cuerpo_html
    cuerpo_texto = None

    if request_data.plantilla_id:
        plantilla = db.query(PlantillaCorreo).filter(
            PlantillaCorreo.id == request_data.plantilla_id,
            PlantillaCorreo.empresa_id == current_user.empresa_id,
            PlantillaCorreo.activo == True
        ).first()
        if not plantilla:
            raise HTTPException(status_code=404, detail="Plantilla no encontrada o inactiva")

        # Renderizar plantilla
        asunto, cuerpo_html, cuerpo_texto = EmailService.render_template(
            plantilla,
            request_data.variables or {}
        )

    # Enviar correo a cada destinatario
    resultados = []
    for destinatario in request_data.destinatarios:
        success, error = EmailService.send_email_sync(
            config=config,
            destinatarios=[destinatario],
            asunto=asunto or "Sin asunto",
            cuerpo_html=cuerpo_html,
            cuerpo_texto=cuerpo_texto,
            adjuntos=request_data.adjuntos
        )

        estado = "enviado" if success else "fallido"
        EmailService.guardar_historial(
            db=db,
            empresa_id=str(current_user.empresa_id),
            configuracion_smtp_id=str(request_data.configuracion_smtp_id),
            plantilla_id=str(request_data.plantilla_id) if request_data.plantilla_id else None,
            destinatario=destinatario,
            asunto=asunto or "Sin asunto",
            cuerpo_html=cuerpo_html,
            cuerpo_texto=cuerpo_texto,
            estado=estado,
            error=error
        )

        resultados.append({
            "destinatario": destinatario,
            "estado": estado,
            "error": error
        })

    return {
        "success": all(r["estado"] == "enviado" for r in resultados),
        "resultados": resultados
    }


# ========== Historial de Correos ==========
@router.get("/historial-correos", response_model=List[HistorialCorreoResponse])
async def listar_historial_correos(
    filtros: HistorialCorreoFiltros = Depends(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lista el historial de correos enviados"""
    query = db.query(HistorialCorreo).filter(
        HistorialCorreo.empresa_id == current_user.empresa_id
    )

    if filtros.configuracion_smtp_id:
        query = query.filter(HistorialCorreo.configuracion_smtp_id == filtros.configuracion_smtp_id)
    if filtros.destinatario:
        query = query.filter(HistorialCorreo.destinatario.ilike(f"%{filtros.destinatario}%"))
    if filtros.estado:
        query = query.filter(HistorialCorreo.estado == filtros.estado)
    if filtros.fecha_desde:
        query = query.filter(HistorialCorreo.enviado_en >= filtros.fecha_desde)
    if filtros.fecha_hasta:
        query = query.filter(HistorialCorreo.enviado_en <= filtros.fecha_hasta)

    return query.order_by(HistorialCorreo.enviado_en.desc()).offset(filtros.offset).limit(filtros.limit).all()




