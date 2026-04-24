"""
Servicio de generación de PDFs
Maneja la conversión de HTML a PDF usando WeasyPrint
"""

import re
import base64
from io import BytesIO
from typing import Dict, Any, Optional
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration
from app.schemas.pdf_schema import PageSize, PageOrientation


class PDFService:
    """Servicio para generar PDFs desde HTML"""

    @staticmethod
    def replace_variables(html_content: str, variables: Optional[Dict[str, Any]] = None) -> str:
        """
        Reemplaza variables en el formato {{variable}} en el HTML
        
        Args:
            html_content: Contenido HTML con variables
            variables: Diccionario con las variables a reemplazar
            
        Returns:
            HTML con variables reemplazadas
        """
        result = html_content or ""

        if variables:
            for key, value in variables.items():
                # Reemplazar {{key}} y {{ key }} (con espacios)
                pattern = r"\{\{\s*" + re.escape(str(key)) + r"\s*\}\}"
                replacement = "" if value is None else str(value)
                result = re.sub(pattern, replacement, result)

        # Limpiar cualquier variable no sustituida para que no aparezca en el PDF final.
        # Ejemplo: {{hora_fecha_asignacion}} -> ""
        result = re.sub(r"\{\{\s*[^{}]+\s*\}\}", "", result)
        return result

    @staticmethod
    def _ensure_pdf_firma_class_on_signature_imgs(html: str) -> str:
        """
        Añade class="pdf-firma" (o la fusiona) en <img> con alt='Firma' (p. ej. Word/Jodit)
        para que el CSS de firma de WeasyPrint siempre aplique.
        """
        if not html:
            return html

        def alt_is_firma(tag: str) -> bool:
            m = re.search(r"\balt\s*=\s*([\"'])([^\"']*)\1", tag, re.IGNORECASE)
            if m:
                return m.group(2).strip().lower() == "firma"
            return False

        def add_class(m: re.Match) -> str:
            tag = m.group(0)
            if "pdf-firma" in tag:
                return tag
            if not alt_is_firma(tag):
                return tag
            cm = re.search(
                r"class\s*=\s*([\"'])([^\"']*)\1", tag, re.IGNORECASE
            )
            if cm:
                q, val = cm.group(1), cm.group(2)
                if "pdf-firma" in val:
                    return tag
                new_val = f"{val} pdf-firma".strip()
                return tag[: cm.start()] + f"class={q}{new_val}{q}" + tag[cm.end() :]
            return re.sub(
                r"<img\b", '<img class="pdf-firma"', tag, count=1, flags=re.IGNORECASE
            )

        return re.sub(
            r"<img\b[^>]*>", add_class, html, flags=re.IGNORECASE
        )

    @staticmethod
    def generate_base_css(
        page_size: PageSize = PageSize.A4,
        orientation: PageOrientation = PageOrientation.PORTRAIT,
        margin_top: str = "1cm",
        margin_bottom: str = "1cm",
        margin_left: str = "1cm",
        margin_right: str = "1cm"
    ) -> str:
        """
        Genera CSS base para el PDF
        
        Returns:
            CSS como string
        """
        return f"""
        @page {{
            size: {page_size.value} {orientation.value};
            margin-top: {margin_top};
            margin-bottom: {margin_bottom};
            margin-left: {margin_left};
            margin-right: {margin_right};
        }}
        
        body {{
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #333;
        }}
        
        /* Tablas: bordes por defecto en celdas (Jodit muestra bordes vía su tema; WeasyPrint no) */
        table {{
            border-collapse: collapse;
        }}
        table td, table th {{
            border: 1px solid #333;
            padding: 4px 8px;
        }}
        
        /* Solo tablas marcadas con esta clase reciben el ancho 100% y márgenes extra */
        table.pdf-default-table {{
            width: 100%;
            margin: 1em 0;
        }}
        
        table.pdf-default-table th,
        table.pdf-default-table td {{
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }}
        
        table.pdf-default-table th {{
            background-color: #f2f2f2;
            font-weight: bold;
        }}

        /* Calificación siniestro: cabecera azul cielo (#B8E4F9), texto #333 */
        td.header-cell.text-center,
        th.header-cell.text-center {{
            border: 1px solid #000;
            padding: 10px 8px;
            text-align: center;
            font-weight: bold;
            text-transform: uppercase;
            vertical-align: middle;
            white-space: normal;
            word-break: break-word;
            overflow-wrap: anywhere;
            line-height: 1.35;
            min-width: 4.75rem;
            background-color: #7de8ff;
            color: #333;
        }}
        td.data-cell.text-center {{
            border: 1px solid #000;
            padding: 10px 8px;
            text-align: center;
            font-size: 13px;
            vertical-align: middle;
            white-space: normal;
            min-width: 4.75rem;
            line-height: 1.4;
            background-color: #fff;
            color: #333;
        }}

        table.calificaciones-siniestro-dinamica {{
            width: 100%;
            max-width: 100%;
            border-collapse: collapse;
            table-layout: auto;
            hyphens: auto;
        }}
        
        /* Estilos para imágenes */
        img {{
            max-width: 100%;
            height: auto;
        }}
        /* Firma: placeholders (class pdf-firma) o imágenes pegadas desde Word/Jodit (alt Firma, attrs width) —
           WeasyPrint puede no respetar solo width/height del HTML y escalar con max-width:100% del img global. */
        img[alt="Firma"],
        img[alt="firma"],
        img.pdf-firma {{
            width: 60px !important;
            max-width: 60px !important;
            height: auto !important;
            display: inline-block;
        }}
        
        /* Estilos para listas */
        ul, ol {{
            margin: 1em 0;
            padding-left: 2em;
        }}
        
        /* Estilos para encabezados */
        h1 {{ font-size: 24pt; margin: 1em 0; }}
        h2 {{ font-size: 20pt; margin: 0.8em 0; }}
        h3 {{ font-size: 16pt; margin: 0.6em 0; }}
        h4 {{ font-size: 14pt; margin: 0.5em 0; }}
        h5 {{ font-size: 12pt; margin: 0.4em 0; }}
        h6 {{ font-size: 10pt; margin: 0.3em 0; }}
        
        /* Estilos para párrafos */
        p {{
            margin: 0.5em 0;
        }}
        
        /* Estilos para texto formateado */
        strong, b {{
            font-weight: bold;
        }}
        
        em, i {{
            font-style: italic;
        }}
        
        u {{
            text-decoration: underline;
        }}
        
        s, strike {{
            text-decoration: line-through;
        }}
        
        /* Estilos para enlaces */
        a {{
            color: #0066cc;
            text-decoration: underline;
        }}
        
        /* Estilos para código */
        code {{
            background-color: #f4f4f4;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }}
        
        pre {{
            background-color: #f4f4f4;
            padding: 1em;
            border-radius: 5px;
            overflow-x: auto;
        }}
        
        /* Estilos para bloques de cita */
        blockquote {{
            border-left: 4px solid #ddd;
            margin: 1em 0;
            padding-left: 1em;
            color: #666;
        }}
        
        /* Estilos para texto alineado */
        .text-left {{ text-align: left; }}
        .text-center {{ text-align: center; }}
        .text-right {{ text-align: right; }}
        .text-justify {{ text-align: justify; }}
        
        /* Evitar saltos de página dentro de elementos */
        .no-break {{
            page-break-inside: avoid;
        }}
        
        /* Estilos para clases comunes de Tailwind/Tiptap */
        .prose {{
            max-width: 100%;
        }}
        
        /* Soporte para header de página en WeasyPrint (running elements) */
        .pdf-page-header-running {{
            position: running(pdfHeader);
            line-height: 1.2;
            box-sizing: border-box;
            padding: 2mm 0 1mm 0;
        }}

        .pdf-page-header-running p {{
            margin: 0;
        }}

        .pdf-page-header-running table {{
            margin: 0;
        }}
        
        .pdf-with-running-header {{
            page: withRunningHeader;
        }}
        
        .prose p {{
            margin-top: 1em;
            margin-bottom: 1em;
        }}
        
        .prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6 {{
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            font-weight: bold;
        }}
        """

    @staticmethod
    def generate_pdf(
        html_content: str,
        page_size: PageSize = PageSize.A4,
        orientation: PageOrientation = PageOrientation.PORTRAIT,
        margin_top: str = "1cm",
        margin_bottom: str = "1cm",
        margin_left: str = "1cm",
        margin_right: str = "1cm",
        custom_css: Optional[str] = None,
        variables: Optional[Dict[str, Any]] = None
    ) -> bytes:
        """
        Genera un PDF desde HTML
        
        Args:
            html_content: Contenido HTML a convertir
            page_size: Tamaño de página
            orientation: Orientación de página
            margin_top: Margen superior
            margin_bottom: Margen inferior
            margin_left: Margen izquierdo
            margin_right: Margen derecho
            custom_css: CSS adicional a aplicar
            variables: Variables para reemplazar en el HTML
            
        Returns:
            PDF como bytes
        """
        # Reemplazar variables en el HTML
        html_with_variables = PDFService.replace_variables(html_content, variables)
        html_with_variables = PDFService._ensure_pdf_firma_class_on_signature_imgs(
            html_with_variables
        )

        # Generar CSS base
        base_css = PDFService.generate_base_css(
            page_size=page_size,
            orientation=orientation,
            margin_top=margin_top,
            margin_bottom=margin_bottom,
            margin_left=margin_left,
            margin_right=margin_right
        )
        
        # Combinar CSS base con CSS personalizado
        full_css = base_css
        if custom_css:
            full_css += "\n" + custom_css
        
        # Crear objeto HTML
        html_doc = HTML(string=html_with_variables)
        
        # Crear configuración de fuentes
        font_config = FontConfiguration()
        
        # Renderizar el documento con los estilos
        document = html_doc.render(stylesheets=[CSS(string=full_css)], font_config=font_config)
        
        # Generar PDF
        pdf_bytes = document.write_pdf()
        
        return pdf_bytes

    @staticmethod
    def generate_pdf_base64(
        html_content: str,
        page_size: PageSize = PageSize.A4,
        orientation: PageOrientation = PageOrientation.PORTRAIT,
        margin_top: str = "1cm",
        margin_bottom: str = "1cm",
        margin_left: str = "1cm",
        margin_right: str = "1cm",
        custom_css: Optional[str] = None,
        variables: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Genera un PDF y lo retorna como base64
        
        Returns:
            PDF codificado en base64
        """
        pdf_bytes = PDFService.generate_pdf(
            html_content=html_content,
            page_size=page_size,
            orientation=orientation,
            margin_top=margin_top,
            margin_bottom=margin_bottom,
            margin_left=margin_left,
            margin_right=margin_right,
            custom_css=custom_css,
            variables=variables
        )
        
        return base64.b64encode(pdf_bytes).decode('utf-8')

