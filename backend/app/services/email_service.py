"""
Servicio para envío de correos electrónicos
"""

import smtplib
from pathlib import Path
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.application import MIMEApplication
from email.mime.image import MIMEImage
from email import encoders
from typing import List, Optional, Dict, Any, Tuple
import logging
from sqlalchemy.orm import Session
from datetime import datetime

# Importaciones opcionales para evitar errores si no están instaladas
try:
    import aiosmtplib
except ImportError:
    aiosmtplib = None

try:
    from jinja2 import Template
except ImportError:
    Template = None

from app.models.config import ConfiguracionSMTP, PlantillaCorreo, HistorialCorreo
from app.core.config import settings

logger = logging.getLogger(__name__)

# Rutas relativas al backend/app para assets de correo (logo e icono) adjuntos como CID
EMAIL_ASSETS_DIR = Path(__file__).resolve().parent.parent / "static" / "email_assets"
EMAIL_LOGO_FILENAME = "logo_dx-legal.png"
EMAIL_FILE_ICON_FILENAME = "file2.png"


def _read_file_bytes(path: Path) -> Optional[bytes]:
    """Lee un archivo y devuelve sus bytes o None."""
    try:
        if path.is_file():
            return path.read_bytes()
    except Exception as e:
        logger.debug("No se pudo leer %s: %s", path, e)
    return None


def get_email_assets_bytes() -> Tuple[Optional[bytes], Optional[bytes]]:
    """
    Carga logo e icono de archivo para adjuntar como CID en correos (evita bloqueo de imágenes por Gmail).
    Busca en backend/app/static/email_assets/ y, si no existe, en frontend/public/assets/.
    Returns:
        (logo_bytes, file_icon_bytes)
    """
    logo_bytes = None
    icon_bytes = None
    # 1) Backend app/static/email_assets
    logo_path = EMAIL_ASSETS_DIR / EMAIL_LOGO_FILENAME
    icon_path = EMAIL_ASSETS_DIR / EMAIL_FILE_ICON_FILENAME
    logo_bytes = _read_file_bytes(logo_path)
    icon_bytes = _read_file_bytes(icon_path)
    # 2) Fallback: frontend/public/assets (desde raíz del proyecto)
    if not logo_bytes or not icon_bytes:
        for base in (Path.cwd(), Path(__file__).resolve().parent.parent.parent.parent):
            frontend_logo = base / "frontend" / "public" / "assets" / "logos" / EMAIL_LOGO_FILENAME
            frontend_icon = base / "frontend" / "public" / "assets" / "icons" / EMAIL_FILE_ICON_FILENAME
            if not logo_bytes:
                logo_bytes = _read_file_bytes(frontend_logo)
            if not icon_bytes:
                icon_bytes = _read_file_bytes(frontend_icon)
            if logo_bytes and icon_bytes:
                break
    return (logo_bytes, icon_bytes)


class EmailService:
    """Servicio para envío de correos electrónicos"""

    @staticmethod
    def test_smtp_connection(config: ConfiguracionSMTP) -> Tuple[bool, Optional[str]]:
        """
        Prueba la conexión SMTP
        
        Returns:
            (success, error_message)
        """
        try:
            if config.usar_ssl:
                server = smtplib.SMTP_SSL(config.servidor, config.puerto, timeout=10)
            else:
                server = smtplib.SMTP(config.servidor, config.puerto, timeout=10)
                if config.usar_tls:
                    server.starttls()

            server.login(config.usuario, config.password)
            server.quit()
            return True, None
        except Exception as e:
            logger.error(f"Error al probar conexión SMTP: {str(e)}")
            return False, str(e)

    @staticmethod
    async def send_email_async(
        config: ConfiguracionSMTP,
        destinatarios: List[str],
        asunto: str,
        cuerpo_html: Optional[str] = None,
        cuerpo_texto: Optional[str] = None,
        adjuntos: Optional[List[str]] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Envía un correo electrónico de forma asíncrona
        
        Returns:
            (success, error_message)
        """
        try:
            message = MIMEMultipart("alternative")
            message["From"] = f"{config.remitente_nombre or 'Sistema'} <{config.remitente_email}>"
            message["To"] = ", ".join(destinatarios)
            message["Subject"] = asunto

            # Agregar cuerpo del mensaje
            if cuerpo_texto:
                part_texto = MIMEText(cuerpo_texto, "plain", "utf-8")
                message.attach(part_texto)

            if cuerpo_html:
                part_html = MIMEText(cuerpo_html, "html", "utf-8")
                message.attach(part_html)
            elif cuerpo_texto:
                # Si solo hay texto, crear HTML básico
                part_html = MIMEText(f"<pre>{cuerpo_texto}</pre>", "html", "utf-8")
                message.attach(part_html)

            # Agregar adjuntos si existen
            if adjuntos:
                for ruta_adjunto in adjuntos:
                    try:
                        with open(ruta_adjunto, "rb") as attachment:
                            part = MIMEBase("application", "octet-stream")
                            part.set_payload(attachment.read())
                            encoders.encode_base64(part)
                            part.add_header(
                                "Content-Disposition",
                                f'attachment; filename= {ruta_adjunto.split("/")[-1]}'
                            )
                            message.attach(part)
                    except Exception as e:
                        logger.warning(f"No se pudo adjuntar archivo {ruta_adjunto}: {str(e)}")

            # Enviar correo
            if aiosmtplib is None:
                raise ImportError("aiosmtplib no está instalado. Instálelo con: pip install aiosmtplib")
            
            if config.usar_ssl:
                await aiosmtplib.send(
                    message,
                    hostname=config.servidor,
                    port=config.puerto,
                    username=config.usuario,
                    password=config.password,
                    use_tls=False,
                    start_tls=False
                )
            else:
                await aiosmtplib.send(
                    message,
                    hostname=config.servidor,
                    port=config.puerto,
                    username=config.usuario,
                    password=config.password,
                    use_tls=config.usar_tls,
                    start_tls=config.usar_tls
                )

            return True, None
        except Exception as e:
            logger.error(f"Error al enviar correo: {str(e)}")
            return False, str(e)

    @staticmethod
    def send_email_sync(
        config: ConfiguracionSMTP,
        destinatarios: List[str],
        asunto: str,
        cuerpo_html: Optional[str] = None,
        cuerpo_texto: Optional[str] = None,
        adjuntos: Optional[List[str]] = None,
        adjuntos_bytes: Optional[List[tuple]] = None,
        firma_cid_bytes: Optional[bytes] = None,
        logo_cid_bytes: Optional[bytes] = None,
        file_icon_cid_bytes: Optional[bytes] = None,
        *,
        incluir_file_icon_solo_si_usa_plantilla: bool = True,
    ) -> Tuple[bool, Optional[str]]:
        """
        Envía un correo electrónico de forma síncrona.
        file_icon (file2) no se agrega como adjunto: solo se incluye como imagen inline (CID)
        cuando la plantilla lo usa (cuerpo_html contiene "cid:file_icon"). Si no lo usa, no se agrega.

        Returns:
            (success, error_message)
        """
        try:
            message = MIMEMultipart("alternative")
            message["From"] = f"{config.remitente_nombre or 'Sistema'} <{config.remitente_email}>"
            message["To"] = ", ".join(destinatarios)
            message["Subject"] = asunto

            # Agregar cuerpo del mensaje
            if cuerpo_texto:
                part_texto = MIMEText(cuerpo_texto, "plain", "utf-8")
                message.attach(part_texto)

            if cuerpo_html:
                part_html = MIMEText(cuerpo_html, "html", "utf-8")
                message.attach(part_html)
            elif cuerpo_texto:
                part_html = MIMEText(f"<pre>{cuerpo_texto}</pre>", "html", "utf-8")
                message.attach(part_html)

            # Agregar adjuntos (rutas en disco)
            if adjuntos:
                for ruta_adjunto in adjuntos:
                    try:
                        with open(ruta_adjunto, "rb") as attachment:
                            part = MIMEBase("application", "octet-stream")
                            part.set_payload(attachment.read())
                            encoders.encode_base64(part)
                            part.add_header(
                                "Content-Disposition",
                                f'attachment; filename= {ruta_adjunto.split("/")[-1]}'
                            )
                            message.attach(part)
                    except Exception as e:
                        logger.warning(f"No se pudo adjuntar archivo {ruta_adjunto}: {str(e)}")
            # Agregar adjuntos en memoria (nombre_archivo, bytes). PDF como application/pdf.
            if adjuntos_bytes:
                for nombre_archivo, contenido in adjuntos_bytes:
                    try:
                        lower = (nombre_archivo or "").lower()
                        if lower.endswith(".pdf"):
                            part = MIMEApplication(contenido, _subtype="pdf")
                            part.add_header(
                                "Content-Disposition",
                                "attachment",
                                filename=nombre_archivo,
                            )
                        else:
                            part = MIMEBase("application", "octet-stream")
                            part.set_payload(contenido)
                            encoders.encode_base64(part)
                            part.add_header(
                                "Content-Disposition",
                                f'attachment; filename="{nombre_archivo}"'
                            )
                        message.attach(part)
                    except Exception as e:
                        logger.warning("No se pudo adjuntar archivo en memoria: %s", e)

            # Imágenes inline (CID) para que Gmail y otros clientes las muestren sin bloquear.
            # file2 (file_icon) solo se agrega si la plantilla lo usa; no va como adjunto descargable.
            usar_file_icon = bool(
                file_icon_cid_bytes
                and (not incluir_file_icon_solo_si_usa_plantilla or (cuerpo_html and "cid:file_icon" in (cuerpo_html or "")))
            )
            cid_parts = [
                ("firma", firma_cid_bytes),
                ("logo", logo_cid_bytes),
                ("file_icon", file_icon_cid_bytes if usar_file_icon else None),
            ]
            for cid_name, img_bytes in cid_parts:
                if not img_bytes:
                    continue
                try:
                    img = MIMEImage(img_bytes, _subtype="png")
                    img.add_header("Content-ID", f"<{cid_name}>")
                    img.add_header("Content-Disposition", "inline", filename=f"{cid_name}.png")
                    message.attach(img)
                except Exception as e:
                    logger.warning("No se pudo adjuntar imagen inline %s: %s", cid_name, e)

            # Conectar y enviar
            if config.usar_ssl:
                server = smtplib.SMTP_SSL(config.servidor, config.puerto, timeout=30)
            else:
                server = smtplib.SMTP(config.servidor, config.puerto, timeout=30)
                if config.usar_tls:
                    server.starttls()

            server.login(config.usuario, config.password)
            server.send_message(message)
            server.quit()

            return True, None
        except Exception as e:
            logger.error(f"Error al enviar correo: {str(e)}")
            return False, str(e)

    @staticmethod
    def render_template(
        plantilla: PlantillaCorreo,
        variables: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, str, Optional[str]]:
        """
        Renderiza una plantilla de correo con variables
        
        Returns:
            (asunto, cuerpo_html)
        """
        if Template is None:
            raise ImportError("jinja2 no está instalado. Instálelo con: pip install jinja2")
        
        variables = variables or {}
        
        # Renderizar asunto
        template_asunto = Template(plantilla.asunto)
        asunto = template_asunto.render(**variables)
        
        # Renderizar cuerpo HTML
        template_html = Template(plantilla.cuerpo_html)
        cuerpo_html = template_html.render(**variables)
        
        # Renderizar cuerpo texto si existe
        cuerpo_texto = None
        if plantilla.cuerpo_texto:
            template_texto = Template(plantilla.cuerpo_texto)
            cuerpo_texto = template_texto.render(**variables)
        
        return asunto, cuerpo_html, cuerpo_texto

    @staticmethod
    def _firma_to_bytes_and_src(firma_digital: str) -> tuple:
        """
        Devuelve (bytes_para_cid, src_para_html).
        Si es data URL se extrae base64 a bytes y src='cid:firma'.
        Si es solo base64 se decodifica a bytes y src='cid:firma'.
        Si es ruta de archivo existente se lee y se devuelve bytes y cid.
        """
        import base64
        import os
        raw = (firma_digital or "").strip()
        if not raw:
            return None, None
        if raw.startswith("data:"):
            # data:image/png;base64,XXXX
            try:
                comma = raw.find(",")
                if comma == -1:
                    return None, None
                b64 = raw[comma + 1 :]
                data = base64.b64decode(b64)
                return data, "cid:firma"
            except Exception:
                return None, None
        if os.path.sep in raw or (len(raw) < 300 and (raw.startswith("/") or ":" in raw[:5])):
            # posible ruta
            if os.path.isfile(raw):
                try:
                    with open(raw, "rb") as f:
                        return f.read(), "cid:firma"
                except Exception:
                    pass
        # base64 puro
        try:
            data = base64.b64decode(raw)
            return data, "cid:firma"
        except Exception:
            return None, None

    @staticmethod
    def get_firma_for_template(
        db: Session,
        usuario: Any,
    ) -> Tuple[Optional[str], Optional[bytes]]:
        """
        Obtiene la firma digital del usuario para usarla dentro de la plantilla.
        Devuelve (firma_url_para_template, firma_bytes_o_none_para_cid).
        Si firma_bytes no es None, se recomienda usar src=\"cid:firma\" en la plantilla
        y adjuntar la imagen con Content-ID: <firma>.
        """
        if not usuario or not getattr(usuario, "id", None):
            return None, None
        from app.models.user import UsuarioPerfil
        perfil = db.query(UsuarioPerfil).filter(UsuarioPerfil.usuario_id == usuario.id).first()
        if not perfil:
            return None, None
        # Solo usar la firma digital para correos; la firma física no se usa como fallback aquí.
        firma_digital = getattr(perfil, "firma_digital", None)
        if not firma_digital or not isinstance(firma_digital, str) or not firma_digital.strip():
            return None, None
        firma_bytes, src = EmailService._firma_to_bytes_and_src(firma_digital)
        if firma_bytes and src == "cid:firma":
            # Dentro de la plantilla se usará src=\"cid:firma\"
            return "cid:firma", firma_bytes
        # Fallback data URL (algunos clientes lo bloquean, pero se respeta)
        raw = firma_digital.strip()
        src = raw if raw.startswith("data:") else f"data:image/png;base64,{raw}"
        return src, None

    @staticmethod
    def guardar_historial(
        db: Session,
        empresa_id: str,
        configuracion_smtp_id: Optional[str],
        plantilla_id: Optional[str],
        destinatario: str,
        asunto: str,
        cuerpo_html: Optional[str],
        cuerpo_texto: Optional[str],
        estado: str,
        error: Optional[str] = None
    ) -> HistorialCorreo:
        """Guarda un registro en el historial de correos"""
        historial = HistorialCorreo(
            empresa_id=empresa_id,
            configuracion_smtp_id=configuracion_smtp_id,
            plantilla_id=plantilla_id,
            destinatario=destinatario,
            asunto=asunto,
            cuerpo_html=cuerpo_html,
            cuerpo_texto=cuerpo_texto,
            estado=estado,
            error=error
        )
        db.add(historial)
        db.commit()
        db.refresh(historial)
        return historial

    # Nombres de plantillas de correo (tabla plantillas_correo)
    NOMBRE_PLANTILLA_NUEVO_SINIESTRO = "Nuevo siniestro"
    NOMBRE_PLANTILLA_NUEVO_INVOLUCRADO = "Nuevo involucrado"
    NOMBRE_PLANTILLA_TE_ENVIAN_ARCHIVO = "Envió de archivo"

    _TIPO_RELACION_LABELS = {
        "asegurado": "Asegurado",
        "proveniente": "Proveniente",
        "testigo": "Testigo",
        "tercero": "Tercero",
    }

    @staticmethod
    def enviar_notificacion_nuevo_siniestro(
        db: Session,
        siniestro: Any,
        current_user: Any,
        destinatarios: List[str],
    ) -> Tuple[bool, Optional[str]]:
        """
        Envía correo de notificación al crear un nuevo siniestro usando la plantilla de correo
        de la base de datos (plantillas_correo) con nombre "Nuevo siniestro".
        Si no hay SMTP, no existe la plantilla o falla el envío, retorna (False, mensaje) sin lanzar excepción.
        """
        if not destinatarios:
            return False, "Sin destinatarios"

        # Obtener primera configuración SMTP activa de la empresa
        config_smtp = db.query(ConfiguracionSMTP).filter(
            ConfiguracionSMTP.empresa_id == current_user.empresa_id,
            ConfiguracionSMTP.activo == True,
        ).first()
        if not config_smtp:
            logger.warning("No hay configuración SMTP activa para la empresa: no se envía correo de nuevo siniestro")
            return False, "Sin configuración SMTP activa"

        # Obtener plantilla de correo desde la base de datos (nombre "Nuevo siniestro")
        plantilla = db.query(PlantillaCorreo).filter(
            PlantillaCorreo.empresa_id == current_user.empresa_id,
            PlantillaCorreo.activo == True,
            PlantillaCorreo.nombre == EmailService.NOMBRE_PLANTILLA_NUEVO_SINIESTRO,
        ).first()
        if not plantilla:
            logger.warning(
                "Plantilla de correo '%s' no encontrada o inactiva para la empresa: no se envía correo",
                EmailService.NOMBRE_PLANTILLA_NUEVO_SINIESTRO,
            )
            return False, f"Plantilla de correo '{EmailService.NOMBRE_PLANTILLA_NUEVO_SINIESTRO}' no encontrada o inactiva"

        # Áreas del siniestro (SiniestroArea + Area)
        from app.models.legal import SiniestroArea, Area
        areas_rel = db.query(SiniestroArea).filter(
            SiniestroArea.siniestro_id == siniestro.id,
            SiniestroArea.activo == True,
        ).all()
        area_ids = [r.area_id for r in areas_rel if r.area_id]
        areas_nombres = []
        if area_ids:
            areas_nombres = [
                a.nombre for a in db.query(Area).filter(Area.id.in_(area_ids)).all()
            ]

        # Fechas formateadas
        fecha_reg = getattr(siniestro, "fecha_registro", None) or datetime.now()
        if hasattr(fecha_reg, "strftime"):
            fecha_creacion_str = fecha_reg.strftime("%d/%m/%Y %H:%M")
        else:
            fecha_creacion_str = str(fecha_reg)
        fecha_asig = getattr(siniestro, "fecha_siniestro", None) or fecha_reg
        if hasattr(fecha_asig, "strftime"):
            fecha_asignacion_str = fecha_asig.strftime("%d/%m/%Y %H:%M")
        else:
            fecha_asignacion_str = str(fecha_asig)

        base_url = getattr(settings, "BASE_URL", None) or getattr(settings, "FRONTEND_URL", None)
        if not base_url:
            raise RuntimeError("BASE_URL o FRONTEND_URL no están configurados en .env")
        base_for_assets = base_url.rstrip("/")
        enlace_ver_id = f"{base_for_assets}/siniestros/{siniestro.id}"
        id_display = getattr(siniestro, "numero_reporte", None) or getattr(siniestro, "numero_siniestro", None) or str(siniestro.id)

        # Logo e icono como CID (como la firma) para que Gmail muestre las imágenes
        logo_cid_bytes, file_icon_cid_bytes = get_email_assets_bytes()
        logo_url = "cid:logo" if logo_cid_bytes else (base_for_assets + getattr(settings, "EMAIL_LOGO_PATH", "/assets/logos/logo_dx-legal.png"))
        file_icon_url = "cid:file_icon" if file_icon_cid_bytes else (base_for_assets + getattr(settings, "EMAIL_FILE_ICON_PATH", "/assets/icons/file2.png"))
        if not logo_cid_bytes and current_user.empresa_id:
            from app.models.user import Empresa
            emp = db.query(Empresa).filter(Empresa.id == current_user.empresa_id).first()
            if emp and getattr(emp, "logo_url", None) and str(emp.logo_url).strip():
                logo_url = (emp.logo_url or "").strip()

        # Firma para usar dentro de la plantilla
        firma_url, firma_cid_bytes = EmailService.get_firma_for_template(db, current_user)

        variables = {
            "id": id_display,
            "enlace_ver_id": enlace_ver_id,
            "areas": areas_nombres,
            "fecha_creacion": fecha_creacion_str,
            "fecha_asignacion": fecha_asignacion_str,
            "logo_url": logo_url,
            "file_icon_url": file_icon_url,
            "base_url": base_url,
            "firma_url": firma_url,
            "ano_actual": str(datetime.now().year),
        }

        try:
            asunto, cuerpo_html, cuerpo_texto = EmailService.render_template(plantilla, variables)
        except Exception as e:
            logger.exception("Error renderizando plantilla de correo")
            return False, str(e)

        success, error = EmailService.send_email_sync(
            config_smtp,
            destinatarios,
            asunto,
            cuerpo_html=cuerpo_html,
            cuerpo_texto=cuerpo_texto,
            firma_cid_bytes=firma_cid_bytes,
            logo_cid_bytes=logo_cid_bytes,
            file_icon_cid_bytes=file_icon_cid_bytes,
        )
        if not success:
            return False, error
        logger.info("Correo de nuevo siniestro enviado a %s", destinatarios)
        return True, None

    @staticmethod
    def enviar_notificacion_nuevo_involucrado(
        db: Session,
        siniestro: Any,
        relacion: Any,
        current_user: Any,
    ) -> Tuple[bool, Optional[str]]:
        """
        Envía correo al usuario asignado como involucrado usando la plantilla "Nuevo involucrado".
        Destinatario: correo del usuario involucrado (relacion.usuario_id).
        Si no hay SMTP, plantilla o el usuario no tiene correo, retorna (False, mensaje) sin lanzar excepción.
        """
        from app.models.user import Usuario
        from app.models.legal import SiniestroArea, Area

        usuario = db.query(Usuario).filter(Usuario.id == relacion.usuario_id).first()
        if not usuario or not getattr(usuario, "correo", None) or not str(usuario.correo).strip():
            return False, "Usuario involucrado sin correo"

        destinatarios = [usuario.correo.strip()]

        config_smtp = db.query(ConfiguracionSMTP).filter(
            ConfiguracionSMTP.empresa_id == current_user.empresa_id,
            ConfiguracionSMTP.activo == True,
        ).first()
        if not config_smtp:
            logger.warning("No hay configuración SMTP activa: no se envía correo de nuevo involucrado")
            return False, "Sin configuración SMTP activa"

        plantilla = db.query(PlantillaCorreo).filter(
            PlantillaCorreo.empresa_id == current_user.empresa_id,
            PlantillaCorreo.activo == True,
            PlantillaCorreo.nombre == EmailService.NOMBRE_PLANTILLA_NUEVO_INVOLUCRADO,
        ).first()
        if not plantilla:
            logger.warning(
                "Plantilla de correo '%s' no encontrada o inactiva: no se envía correo",
                EmailService.NOMBRE_PLANTILLA_NUEVO_INVOLUCRADO,
            )
            return False, f"Plantilla '{EmailService.NOMBRE_PLANTILLA_NUEVO_INVOLUCRADO}' no encontrada o inactiva"

        areas_rel = db.query(SiniestroArea).filter(
            SiniestroArea.siniestro_id == siniestro.id,
            SiniestroArea.activo == True,
        ).all()
        area_ids = [r.area_id for r in areas_rel if r.area_id]
        areas_nombres = [
            a.nombre for a in db.query(Area).filter(Area.id.in_(area_ids)).all()
        ] if area_ids else []

        tipo_relacion = getattr(relacion, "tipo_relacion", "") or ""
        tipo_relacion_label = EmailService._TIPO_RELACION_LABELS.get(
            tipo_relacion.lower(), tipo_relacion or "Involucrado"
        )

        fecha_asig = getattr(relacion, "creado_en", None) or datetime.now()
        if hasattr(fecha_asig, "strftime"):
            fecha_asignacion_str = fecha_asig.strftime("%d/%m/%Y %H:%M")
        else:
            fecha_asignacion_str = str(fecha_asig)

        base_url = getattr(settings, "BASE_URL", None) or getattr(settings, "FRONTEND_URL", None)
        if not base_url:
            raise RuntimeError("BASE_URL o FRONTEND_URL no están configurados en .env")
        base_for_assets = base_url.rstrip("/")
        enlace_ver_id = f"{base_for_assets}/siniestros/{siniestro.id}"
        id_display = getattr(siniestro, "numero_reporte", None) or getattr(siniestro, "numero_siniestro", None) or str(siniestro.id)

        logo_cid_bytes, file_icon_cid_bytes = get_email_assets_bytes()
        logo_url = "cid:logo" if logo_cid_bytes else (base_for_assets + getattr(settings, "EMAIL_LOGO_PATH", "/assets/logos/logo_dx-legal.png"))
        if not logo_cid_bytes and current_user.empresa_id:
            from app.models.user import Empresa
            emp = db.query(Empresa).filter(Empresa.id == current_user.empresa_id).first()
            if emp and getattr(emp, "logo_url", None) and str(emp.logo_url).strip():
                logo_url = (emp.logo_url or "").strip()

        firma_url, firma_cid_bytes = EmailService.get_firma_for_template(db, current_user)

        variables = {
            "id": id_display,
            "enlace_ver_id": enlace_ver_id,
            "areas": areas_nombres,
            "tipo_relacion": tipo_relacion,
            "tipo_relacion_label": tipo_relacion_label,
            "fecha_asignacion": fecha_asignacion_str,
            "logo_url": logo_url,
            "base_url": base_url,
            "firma_url": firma_url,
            "ano_actual": str(datetime.now().year),
        }

        try:
            asunto, cuerpo_html, cuerpo_texto = EmailService.render_template(plantilla, variables)
        except Exception as e:
            logger.exception("Error renderizando plantilla de correo nuevo involucrado")
            return False, str(e)

        success, error = EmailService.send_email_sync(
            config_smtp,
            destinatarios,
            asunto,
            cuerpo_html=cuerpo_html,
            cuerpo_texto=cuerpo_texto,
            firma_cid_bytes=firma_cid_bytes,
            logo_cid_bytes=logo_cid_bytes,
            file_icon_cid_bytes=file_icon_cid_bytes,
        )
        if not success:
            return False, error
        logger.info("Correo de nuevo involucrado enviado a %s", destinatarios)
        return True, None

