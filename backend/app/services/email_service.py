"""
Servicio para envío de correos electrónicos
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
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

logger = logging.getLogger(__name__)


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
        adjuntos: Optional[List[str]] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Envía un correo electrónico de forma síncrona
        
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

            # Agregar adjuntos
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

