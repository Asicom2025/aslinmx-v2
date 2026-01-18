"""
Servicio para validar tokens de reCAPTCHA Enterprise v3
Usa Google Cloud reCAPTCHA Enterprise API
"""

import asyncio
from typing import Optional
from google.cloud import recaptchaenterprise_v1
from google.cloud.recaptchaenterprise_v1 import Assessment
from app.core.config import settings


class RecaptchaService:
    """Servicio para validar tokens de reCAPTCHA Enterprise v3"""

    @staticmethod
    async def create_assessment(
        token: str,
        recaptcha_action: str = "login",
        remote_ip: Optional[str] = None
    ) -> Optional[Assessment]:
        """
        Crea una evaluación para analizar el riesgo de una acción de la IU.
        
        Args:
            token: El token generado obtenido del cliente
            recaptcha_action: El nombre de la acción que corresponde al token (default: "login")
            remote_ip: IP del cliente (opcional)
            
        Returns:
            Assessment object si es válido, None en caso contrario
        """
        # Si no está configurado, permitir acceso (modo desarrollo)
        if not settings.GOOGLE_CLOUD_PROJECT_ID or not settings.RECAPTCHA_KEY:
            return None  # Se manejará en is_valid como válido

        if not token:
            return None

        try:
            # Ejecutar la llamada síncrona en un thread pool para no bloquear
            assessment = await asyncio.to_thread(
                RecaptchaService._create_assessment_sync,
                token,
                recaptcha_action,
                remote_ip
            )
            return assessment
        except Exception as e:
            print(f"Error al crear evaluación de reCAPTCHA: {str(e)}")
            return None

    @staticmethod
    def _create_assessment_sync(
        token: str,
        recaptcha_action: str,
        remote_ip: Optional[str] = None
    ) -> Optional[Assessment]:
        """
        Versión síncrona de create_assessment para ejecutar en thread pool
        
        Nota: RecaptchaEnterpriseServiceClient() usa Application Default Credentials (ADC)
        automáticamente. ADC busca credenciales en este orden:
        1. Variable de entorno GOOGLE_APPLICATION_CREDENTIALS (archivo JSON)
        2. Credenciales de usuario de gcloud CLI (gcloud auth application-default login)
        3. Credenciales de cuenta de servicio conectada al recurso (en Google Cloud)
        4. Workload Identity Federation (para otros proveedores de nube)
        
        Ver: https://docs.cloud.google.com/recaptcha/docs/authentication
        """
        # El cliente usa ADC automáticamente - no necesita configuración explícita
        client = recaptchaenterprise_v1.RecaptchaEnterpriseServiceClient()

        # Establece las propiedades del evento para realizar un seguimiento
        event = recaptchaenterprise_v1.Event()
        event.site_key = settings.RECAPTCHA_KEY
        event.token = token
        
        if remote_ip:
            event.user_ip_address = remote_ip

        assessment = recaptchaenterprise_v1.Assessment()
        assessment.event = event

        project_name = f"projects/{settings.GOOGLE_CLOUD_PROJECT_ID}"

        # Crea la solicitud de evaluación
        request = recaptchaenterprise_v1.CreateAssessmentRequest()
        request.assessment = assessment
        request.parent = project_name

        response = client.create_assessment(request)

        # Verifica si el token es válido
        if not response.token_properties.valid:
            print(
                "The CreateAssessment call failed because the token was "
                + "invalid for the following reasons: "
                + str(response.token_properties.invalid_reason)
            )
            return None

        # Verifica si se ejecutó la acción esperada
        if response.token_properties.action != recaptcha_action:
            print(
                f"The action attribute in your reCAPTCHA tag ({response.token_properties.action}) "
                + f"does not match the action you are expecting to score ({recaptcha_action})"
            )
            return None

        # Obtén la puntuación de riesgo y los motivos
        # Para obtener más información sobre cómo interpretar la evaluación, consulta:
        # https://cloud.google.com/recaptcha-enterprise/docs/interpret-assessment
        if response.risk_analysis.reasons:
            print("Risk analysis reasons:")
            for reason in response.risk_analysis.reasons:
                print(f"  - {reason}")

        print(
            f"The reCAPTCHA score for this token is: {response.risk_analysis.score}"
        )

        # Obtén el nombre de la evaluación (ID). Úsalo para anotar la evaluación
        assessment_name = client.parse_assessment_path(response.name).get("assessment")
        print(f"Assessment name: {assessment_name}")

        return response

    @staticmethod
    async def verify_token(
        token: str,
        remote_ip: Optional[str] = None,
        recaptcha_action: str = "login"
    ) -> dict:
        """
        Verifica un token de reCAPTCHA Enterprise v3
        
        Args:
            token: Token de reCAPTCHA recibido del frontend
            remote_ip: IP del cliente (opcional, recomendado)
            recaptcha_action: Acción esperada (default: "login")
            
        Returns:
            Dict con:
                - success: bool - Si la verificación fue exitosa
                - score: float - Score de reCAPTCHA (0.0 a 1.0)
                - action: str - Acción verificada
                - valid: bool - Si el token es válido
                - reasons: List[str] - Razones del análisis de riesgo
        """
        # Si no está configurado, permitir acceso (modo desarrollo)
        if not settings.GOOGLE_CLOUD_PROJECT_ID or not settings.RECAPTCHA_KEY:
            return {
                "success": True,
                "score": 1.0,
                "action": recaptcha_action,
                "valid": True,
                "reasons": []
            }

        if not token:
            return {
                "success": False,
                "score": 0.0,
                "action": None,
                "valid": False,
                "reasons": ["missing-input-response"]
            }

        assessment = await RecaptchaService.create_assessment(
            token,
            recaptcha_action,
            remote_ip
        )

        if not assessment:
            return {
                "success": False,
                "score": 0.0,
                "action": None,
                "valid": False,
                "reasons": ["invalid-token"]
            }

        # Extraer información del assessment
        reasons = [str(reason) for reason in assessment.risk_analysis.reasons] if assessment.risk_analysis.reasons else []

        return {
            "success": True,
            "score": assessment.risk_analysis.score,
            "action": assessment.token_properties.action,
            "valid": assessment.token_properties.valid,
            "reasons": reasons
        }

    @staticmethod
    def is_valid(verification_result: dict, min_score: float = 0.5) -> bool:
        """
        Verifica si el resultado de reCAPTCHA es válido
        
        Args:
            verification_result: Resultado de verify_token
            min_score: Score mínimo requerido (default 0.5)
            
        Returns:
            True si es válido, False en caso contrario
        """
        # Si no está configurado, permitir acceso
        if not settings.GOOGLE_CLOUD_PROJECT_ID or not settings.RECAPTCHA_KEY:
            return True

        if not verification_result.get("success"):
            return False

        if not verification_result.get("valid"):
            return False

        score = verification_result.get("score", 0.0)
        if score < min_score:
            return False

        # Verificar que la acción sea la esperada
        action = verification_result.get("action")
        expected_action = "login"
        if action != expected_action:
            return False

        return True
