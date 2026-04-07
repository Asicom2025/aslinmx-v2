"""
Rutas para configuración del sistema (SMTP, plantillas, etc.)
"""

import base64
import binascii
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
    EnviarArchivoCorreoRequest,
    HistorialCorreoResponse,
    HistorialCorreoFiltros,
)
from app.schemas.storage_schema import StorageReconciliationResponse, StorageSummaryResponse
from app.services.email_service import EmailService, get_email_assets_bytes
from app.services.auditoria_service import AuditoriaService
from pathlib import Path

from app.services.legal_service import DocumentoService, TiposDocumentoService, SiniestroService
from app.api.routes.pdf_routes import generar_pdf_bytes_para_documento
from app.core.config import settings
from app.services.storage_ops_service import StorageReconciliationService
from app.services.storage_service import StorageError, get_storage_service

router = APIRouter()


@router.get("/storage/estado", response_model=StorageSummaryResponse)
async def obtener_estado_storage(
    verify_objects: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Resumen operativo del storage para la empresa activa."""
    empresa_id = current_user.empresa_id
    if not empresa_id:
        raise HTTPException(status_code=400, detail="El usuario actual no tiene una empresa activa.")

    return StorageReconciliationService.summarize_company(
        db,
        empresa_id=empresa_id,
        verify_objects=verify_objects,
        sample_limit=settings.STORAGE_RECONCILE_SAMPLE_LIMIT,
    )


@router.post("/storage/reconciliar", response_model=StorageReconciliationResponse)
async def reconciliar_storage(
    request: Request,
    verify_objects: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Marca metadata huérfana como inactiva/eliminada sin borrar el objeto físico."""
    empresa_id = current_user.empresa_id
    if not empresa_id:
        raise HTTPException(status_code=400, detail="El usuario actual no tiene una empresa activa.")

    result = StorageReconciliationService.reconcile_company(
        db,
        empresa_id=empresa_id,
        verify_objects=verify_objects,
        sample_limit=settings.STORAGE_RECONCILE_SAMPLE_LIMIT,
    )

    AuditoriaService.registrar_accion(
        db=db,
        usuario_id=current_user.id,
        empresa_id=empresa_id,
        accion="storage_reconciliado",
        modulo="configuracion",
        tabla="storage_objects",
        registro_id=None,
        datos_nuevos=result,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        descripcion="Se ejecutó la reconciliación operativa de storage",
    )
    return result


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

    # Cuerpo del correo de prueba y firma del usuario (si existe)
    cuerpo_html = f"<p>{test_request.mensaje}</p>"
    _, firma_cid_bytes = EmailService.get_firma_for_template(db, current_user)

    # Enviar correo de prueba
    success, error = EmailService.send_email_sync(
        config=config,
        destinatarios=[test_request.destinatario],
        asunto=test_request.asunto,
        cuerpo_html=cuerpo_html,
        cuerpo_texto=test_request.mensaje,
        firma_cid_bytes=firma_cid_bytes,
    )

    if not success:
        raise HTTPException(status_code=400, detail=f"Error al enviar correo: {error}")

    # Guardar en historial (incluye cuerpo con firma si aplica)
    EmailService.guardar_historial(
        db=db,
        empresa_id=str(current_user.empresa_id),
        configuracion_smtp_id=str(config_id),
        plantilla_id=None,
        destinatario=test_request.destinatario,
        asunto=test_request.asunto,
        cuerpo_html=cuerpo_html,
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

    base_url = getattr(settings, "BASE_URL", None) or getattr(settings, "FRONTEND_URL", None)
    if not base_url:
        raise HTTPException(
            status_code=500,
            detail="BASE_URL o FRONTEND_URL no están configurados en el backend. Configúralos en el .env."
        )
    base_for_assets = base_url.rstrip("/")
    unsubscribe_url = f"{base_for_assets}/unsubscribe"
    unsubscribe_mailto = f"mailto:{config.remitente_email}?subject=unsubscribe"

    # Obtener plantilla si se especificó
    asunto = request_data.asunto
    cuerpo_html = request_data.cuerpo_html
    cuerpo_texto = None
    firma_cid_bytes = None
    logo_cid_bytes = None
    file_icon_cid_bytes = None

    if request_data.plantilla_id:
        plantilla = db.query(PlantillaCorreo).filter(
            PlantillaCorreo.id == request_data.plantilla_id,
            PlantillaCorreo.empresa_id == current_user.empresa_id,
            PlantillaCorreo.activo == True
        ).first()
        if not plantilla:
            raise HTTPException(status_code=404, detail="Plantilla no encontrada o inactiva")

        # Logo e icono como CID para que Gmail muestre las imágenes
        logo_cid_bytes, file_icon_cid_bytes = get_email_assets_bytes()
        logo_url = "cid:logo" if logo_cid_bytes else (base_for_assets + getattr(settings, "EMAIL_LOGO_PATH", "/assets/logos/logo_dx-legal.png"))
        file_icon_url = "cid:file_icon" if file_icon_cid_bytes else (base_for_assets + getattr(settings, "EMAIL_FILE_ICON_PATH", "/assets/icons/file2.png"))
        if not logo_cid_bytes and current_user.empresa_id:
            from app.models.user import Empresa
            emp = db.query(Empresa).filter(Empresa.id == current_user.empresa_id).first()
            if emp and getattr(emp, "logo_url", None) and str(emp.logo_url).strip():
                logo_url = (emp.logo_url or "").strip()
        firma_url, firma_cid_bytes = EmailService.get_firma_for_template(db, current_user)
        template_defaults = {
            "logo_url": logo_url,
            "file_icon_url": file_icon_url,
            "base_url": base_for_assets,
            "firma_url": firma_url,
            "unsubscribe_url": unsubscribe_url,
        }
        variables = {**template_defaults, **(request_data.variables or {})}

        # Renderizar plantilla
        asunto, cuerpo_html, cuerpo_texto = EmailService.render_template(
            plantilla,
            variables
        )
        

    cc_list = [str(e) for e in (request_data.cc or [])]
    cco_list = [str(e) for e in (request_data.cco or [])]

    # Enviar correo a cada destinatario principal; CC/CCO se incluyen como copia en cada envío
    resultados = []
    for destinatario in request_data.destinatarios:
        success, error = EmailService.send_email_sync(
            config=config,
            destinatarios=[destinatario],
            asunto=asunto or "Sin asunto",
            cuerpo_html=cuerpo_html,
            cuerpo_texto=cuerpo_texto,
            adjuntos=request_data.adjuntos,
            firma_cid_bytes=firma_cid_bytes,
            logo_cid_bytes=logo_cid_bytes if request_data.plantilla_id else None,
            file_icon_cid_bytes=file_icon_cid_bytes if request_data.plantilla_id else None,
            list_unsubscribe_url=unsubscribe_url,
            list_unsubscribe_mailto=unsubscribe_mailto,
            list_unsubscribe_one_click=True,
            cc=cc_list,
            cco=cco_list,
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


@router.post("/enviar-archivo-correo")
async def enviar_archivo_correo(
    request_data: EnviarArchivoCorreoRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Envía un correo usando la plantilla "Te envían un archivo".
    Variables: enlace_descarga (link a siniestro/documentos), c1=tipo documento, c2=categorías, textMail=mensaje.
    Si se envía documento_id y el documento es un informe (tiene plantilla), se adjunta el PDF automáticamente.
    """
    config = db.query(ConfiguracionSMTP).filter(
        ConfiguracionSMTP.id == request_data.configuracion_smtp_id,
        ConfiguracionSMTP.empresa_id == current_user.empresa_id,
        ConfiguracionSMTP.activo == True,
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuración SMTP no encontrada o inactiva")

    plantilla = db.query(PlantillaCorreo).filter(
        PlantillaCorreo.empresa_id == current_user.empresa_id,
        PlantillaCorreo.activo == True,
        PlantillaCorreo.nombre == EmailService.NOMBRE_PLANTILLA_TE_ENVIAN_ARCHIVO,
    ).first()
    if not plantilla:
        raise HTTPException(
            status_code=404,
            detail=f"Plantilla de correo '{EmailService.NOMBRE_PLANTILLA_TE_ENVIAN_ARCHIVO}' no encontrada o inactiva. Créala en Configuración > General.",
        )

    c1 = request_data.tipo_documento_nombre or ""
    c2 = request_data.categoria_nombre or ""
    # Soportar uno o varios documentos
    documento_ids: List[UUID] = []
    if request_data.documento_id:
        documento_ids.append(request_data.documento_id)
    if getattr(request_data, "documentos_ids", None):
        documento_ids.extend([d for d in request_data.documentos_ids or [] if d not in documento_ids])

    # Primer documento: c1/c2 y valor por defecto de {{ asunto }}
    primer_doc = None
    if documento_ids:
        primer_doc = DocumentoService.get_by_id(db, documento_ids[0])
        if primer_doc:
            if not c1 and primer_doc.tipo_documento_id:
                td = TiposDocumentoService.get_by_id(db, primer_doc.tipo_documento_id)
                if td:
                    c1 = getattr(td, "nombre", "") or ""
            if not c2 and getattr(primer_doc, "plantilla_origen", None) and getattr(primer_doc.plantilla_origen, "categoria", None):
                c2 = getattr(primer_doc.plantilla_origen.categoria, "nombre", "") or ""

    asunto_var = (request_data.asunto or "").strip()
    if not asunto_var and primer_doc:
        asunto_var = (getattr(primer_doc, "nombre_archivo", None) or "").strip()
    if not asunto_var and current_user.empresa_id:
        sin_obj = SiniestroService.get_by_id(
            db, request_data.siniestro_id, current_user.empresa_id
        )
        if sin_obj:
            ref = (
                (getattr(sin_obj, "numero_siniestro", None) or "").strip()
                or (getattr(sin_obj, "codigo", None) or "").strip()
            )
            asunto_var = (
                f"Documento de siniestro {ref}".strip()
                if ref
                else f"Siniestro {request_data.siniestro_id}"
            )
    if not asunto_var:
        asunto_var = "Te envían un archivo"

    base_url = getattr(settings, "BASE_URL", None) or getattr(settings, "FRONTEND_URL", None)
    if not base_url:
        raise HTTPException(
            status_code=500,
            detail="BASE_URL o FRONTEND_URL no están configurados en el backend. Configúralos en el .env."
        )
    backend_url = getattr(settings, "BACKEND_URL", None)
    if not backend_url:
        raise HTTPException(
            status_code=500,
            detail="BACKEND_URL no está configurado en el backend. Configúralo en el .env."
        )
    # Enlace de descarga: si hay documento, apuntar directo al endpoint de archivo;
    # si no, al detalle del siniestro.
    enlace_descarga = f"{base_url.rstrip('/')}/siniestros/{request_data.siniestro_id}"
    if documento_ids:
        # Para enlace directo usamos el primer documento; si hay más, igual llegan como adjuntos.
        enlace_descarga = f"{backend_url.rstrip('/')}/api/v1/documentos/{documento_ids[0]}/archivo"

    # Logo e icono: adjuntar como CID (como la firma) para que Gmail muestre las imágenes
    logo_cid_bytes, file_icon_cid_bytes = get_email_assets_bytes()
    base_for_assets = base_url.rstrip("/")
    logo_url = "cid:logo" if logo_cid_bytes else (base_for_assets + getattr(settings, "EMAIL_LOGO_PATH", "/assets/logos/logo_dx-legal.png"))
    file_icon_url = "cid:file_icon" if file_icon_cid_bytes else (base_for_assets + getattr(settings, "EMAIL_FILE_ICON_PATH", "/assets/icons/file2.png"))
    if not logo_cid_bytes and current_user.empresa_id:
        from app.models.user import Empresa
        emp = db.query(Empresa).filter(Empresa.id == current_user.empresa_id).first()
        if emp and getattr(emp, "logo_url", None) and str(emp.logo_url).strip():
            logo_url = (emp.logo_url or "").strip()

    # Firma tomada del perfil para la plantilla, y bytes para CID
    firma_url, firma_cid_bytes = EmailService.get_firma_for_template(db, current_user)

    from datetime import datetime
    variables = {
        "enlace_descarga": enlace_descarga,
        "c1": c1,
        "c2": c2,
        "c3": "",
        "textMail": request_data.mensaje or "",
        "asunto": asunto_var,
        "logo_url": logo_url,
        "file_icon_url": file_icon_url,
        "base_url": base_url,
        "firma_url": firma_url,
        "unsubscribe_url": f"{base_url.rstrip('/')}/unsubscribe",
        "ano_actual": str(datetime.now().year),
    }

    asunto, cuerpo_html, cuerpo_texto = EmailService.render_template(plantilla, variables)

    adjuntos_bytes = []
    storage_service = get_storage_service()
    # Generar/adjuntar todos los documentos solicitados
    for doc_id in documento_ids:
        pdf_result = generar_pdf_bytes_para_documento(db, doc_id, current_user)
        if pdf_result:
            # generar_pdf_bytes_para_documento retorna (bytes_pdf, nombre_archivo);
            # send_email_sync espera (nombre_archivo, contenido_bytes).
            pdf_bytes, nombre_pdf = pdf_result[0], pdf_result[1]
            adjuntos_bytes.append((nombre_pdf, pdf_bytes))

        doc = DocumentoService.get_by_id(db, doc_id)
        # Además del PDF del informe, adjuntar el archivo persistido en storage si existe.
        if doc and getattr(doc, "ruta_archivo", None):
            ruta_str = doc.ruta_archivo.strip()
            if ruta_str:
                try:
                    contenido_bytes = storage_service.get_bytes(ruta_str)
                    nombre = (doc.nombre_archivo or Path(ruta_str).name) or "adjunto"
                    adjuntos_bytes.append((nombre, contenido_bytes))
                except StorageError:
                    pass

    # Adjuntos adicionales enviados desde frontend en base64
    if request_data.archivos_adjuntos:
        for archivo in request_data.archivos_adjuntos:
            nombre = (archivo.get("nombre") or "").strip()
            contenido_base64 = (archivo.get("contenido_base64") or "").strip()
            if not nombre or not contenido_base64:
                continue
            try:
                if "," in contenido_base64:
                    contenido_base64 = contenido_base64.split(",", 1)[1]
                contenido_bytes = base64.b64decode(contenido_base64, validate=True)
                adjuntos_bytes.append((nombre, contenido_bytes))
            except (ValueError, binascii.Error):
                # Ignorar adjuntos malformados para no frenar todo el envío
                continue

    cc_list = [str(e) for e in (request_data.cc or [])]
    cco_list = [str(e) for e in (request_data.cco or [])]

    # Enviar una sola vez con todos los destinatarios principales para asegurar entrega múltiple.
    success, error = EmailService.send_email_sync(
        config=config,
        destinatarios=list(request_data.destinatarios),
        asunto=asunto or "Te envían un archivo",
        cuerpo_html=cuerpo_html,
        cuerpo_texto=cuerpo_texto,
        adjuntos_bytes=adjuntos_bytes if adjuntos_bytes else None,
        firma_cid_bytes=firma_cid_bytes,
        logo_cid_bytes=logo_cid_bytes,
        file_icon_cid_bytes=file_icon_cid_bytes,
        list_unsubscribe_url=variables["unsubscribe_url"],
        list_unsubscribe_mailto=f"mailto:{config.remitente_email}?subject=unsubscribe",
        list_unsubscribe_one_click=True,
        cc=cc_list,
        cco=cco_list,
    )

    estado = "enviado" if success else "fallido"
    resultados = []
    todos_destinatarios = list(request_data.destinatarios) + cc_list + cco_list
    for destinatario in todos_destinatarios:
        EmailService.guardar_historial(
            db=db,
            empresa_id=str(current_user.empresa_id),
            configuracion_smtp_id=str(request_data.configuracion_smtp_id),
            plantilla_id=str(plantilla.id),
            destinatario=destinatario,
            asunto=asunto or "Te envían un archivo",
            cuerpo_html=cuerpo_html,
            cuerpo_texto=cuerpo_texto,
            estado=estado,
            error=error,
        )
        resultados.append({"destinatario": destinatario, "estado": estado, "error": error})

    return {
        "success": all(r["estado"] == "enviado" for r in resultados),
        "resultados": resultados,
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




