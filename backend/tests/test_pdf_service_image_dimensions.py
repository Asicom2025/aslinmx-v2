import sys
import types


weasyprint = types.ModuleType("weasyprint")
weasyprint.HTML = object
weasyprint.CSS = object
sys.modules["weasyprint"] = weasyprint

weasyprint_text = types.ModuleType("weasyprint.text")
weasyprint_fonts = types.ModuleType("weasyprint.text.fonts")
weasyprint_fonts.FontConfiguration = object
sys.modules["weasyprint.text"] = weasyprint_text
sys.modules["weasyprint.text.fonts"] = weasyprint_fonts

from app.services.pdf_service import PDFService


def test_jodit_image_width_prefers_auto_height_to_keep_ratio():
    html = '<p><img src="data:image/png;base64,AAAA" width="87" height="56"></p>'

    result = PDFService._normalize_jodit_image_dimensions_for_pdf(html)

    assert 'width="87"' in result
    assert 'height="56"' in result
    assert 'style="width: 87px; height: auto;' in result
    assert "max-width" not in result
    assert "object-fit" not in result


def test_jodit_image_keeps_existing_width_and_uses_auto_height():
    html = '<img src="x.png" style="margin: 4px; width: 80px" height="40"/>'

    result = PDFService._normalize_jodit_image_dimensions_for_pdf(html)

    assert "margin: 4px" in result
    assert "width: 80px" in result
    assert "max-width" not in result
    assert "height: auto" in result


def test_jodit_image_removes_existing_max_width_style():
    html = '<img src="x.png" style="width: 80px; max-width: 100%" height="40"/>'

    result = PDFService._normalize_jodit_image_dimensions_for_pdf(html)

    assert "width: 80px" in result
    assert "max-width" not in result
    assert "height: auto" in result


def test_percent_width_stays_responsive_for_pdf_page_width():
    html = '<img src="x.png" width="50%" height="20">'

    result = PDFService._normalize_jodit_image_dimensions_for_pdf(html)

    assert "width: 50%" in result
    assert "max-width" not in result
    assert "height: auto" in result


def test_height_only_image_keeps_height_and_auto_width():
    html = '<img src="x.png" height="40">'

    result = PDFService._normalize_jodit_image_dimensions_for_pdf(html)

    assert "width: auto" in result
    assert "height: 40px" in result


def test_images_without_jodit_dimensions_are_left_untouched():
    html = '<p><img src="x.png" alt="Sin dimensiones"></p>'

    assert PDFService._normalize_jodit_image_dimensions_for_pdf(html) == html
