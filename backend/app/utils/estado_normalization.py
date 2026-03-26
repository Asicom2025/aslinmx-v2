"""
Utilidades para normalizar estados geográficos de México.
"""


def normalizar_nombre_estado(nombre: str) -> str:
    """
    Normaliza nombres de estados inconsistentes a nombres canónicos.
    Maneja variaciones como mayúsculas/minúsculas, acentos, ciudades y abreviaciones.
    """
    if not nombre:
        return "Sin estado"

    nombre_limpio = nombre.strip().lower()

    mapeo_estados = {
        "aguascalientes": "Aguascalientes",
        "baja california": "Baja California",
        "baja california sur": "Baja California Sur",
        "campeche": "Campeche",
        "chiapas": "Chiapas",
        "motozintla, chiapas": "Chiapas",
        "tapachula, chiapas": "Chiapas",
        "tapachula chiapas": "Chiapas",
        "chihuahua": "Chihuahua",
        "ciudad de mexico": "Ciudad de México",
        "ciudad de méxico": "Ciudad de México",
        "cdmx": "Ciudad de México",
        "mexico": "Ciudad de México",
        "coahuila": "Coahuila",
        "coahuila de zaragoza": "Coahuila",
        "torreon, coah.": "Coahuila",
        "colima": "Colima",
        "durango": "Durango",
        "estado de mexico": "Estado de México",
        "estado de méxico": "Estado de México",
        "edo. de mexico": "Estado de México",
        "edo de mexico": "Estado de México",
        "naualpan, edo. mex.": "Estado de México",
        "naucalpan, edo mex": "Estado de México",
        "toluca, edo mex": "Estado de México",
        "metepec, edo. mex.": "Estado de México",
        "cuautitlan izcalli, edo. mex.": "Estado de México",
        "guanajuato": "Guanajuato",
        "silao, guanajuato": "Guanajuato",
        "celaya, gto.": "Guanajuato",
        "leon, gto.": "Guanajuato",
        "guerrero": "Guerrero",
        "hidalgo": "Hidalgo",
        "jalisco": "Jalisco",
        "guadalajara, jalisco": "Jalisco",
        "guadalajara": "Jalisco",
        "michoacan": "Michoacán",
        "michoacán": "Michoacán",
        "morelos": "Morelos",
        "cuernavaca, morelos": "Morelos",
        "cuernavaca, mor.": "Morelos",
        "cuernavaca, mor": "Morelos",
        "nayarit": "Nayarit",
        "nuevo leon": "Nuevo León",
        "nuevo león": "Nuevo León",
        "monterrey": "Nuevo León",
        "municipio escobedo,  n.l.": "Nuevo León",
        "municipio escobedo, n.l.": "Nuevo León",
        "oaxaca": "Oaxaca",
        "puebla": "Puebla",
        "puebla, pue.": "Puebla",
        "queretaro": "Querétaro",
        "querétaro": "Querétaro",
        "quintana roo": "Quintana Roo",
        "san luis potosi": "San Luis Potosí",
        "san luis potosí": "San Luis Potosí",
        "s.l.p.": "San Luis Potosí",
        "sinaloa": "Sinaloa",
        "los mochis, sinaloa": "Sinaloa",
        "sonora": "Sonora",
        "tabasco": "Tabasco",
        "tamaulipas": "Tamaulipas",
        "tlaxcala": "Tlaxcala",
        "veracruz": "Veracruz",
        "veracruz de ignacio de la llav": "Veracruz",
        "yucatan": "Yucatán",
        "yucatán": "Yucatán",
        "zacatecas": "Zacatecas",
    }

    if nombre_limpio in mapeo_estados:
        return mapeo_estados[nombre_limpio]

    if "estado de" in nombre_limpio or (
        "edo" in nombre_limpio and ("méxico" in nombre_limpio or "mexico" in nombre_limpio)
    ):
        return "Estado de México"

    if ("méxico" in nombre_limpio or "mexico" in nombre_limpio) and "edo" not in nombre_limpio:
        return "Ciudad de México"

    palabras_clave = {
        "chiapas": "Chiapas",
        "guanajuato": "Guanajuato",
        "gto": "Guanajuato",
        "jalisco": "Jalisco",
        "morelos": "Morelos",
        "mor": "Morelos",
        "nuevo leon": "Nuevo León",
        "n.l": "Nuevo León",
        "monterrey": "Nuevo León",
        "oaxaca": "Oaxaca",
        "puebla": "Puebla",
        "pue": "Puebla",
        "coahuila": "Coahuila",
        "coah": "Coahuila",
        "sinaloa": "Sinaloa",
        "sonora": "Sonora",
        "tabasco": "Tabasco",
        "tlaxcala": "Tlaxcala",
        "veracruz": "Veracruz",
        "yucatan": "Yucatán",
        "zacatecas": "Zacatecas",
    }

    for palabra, estado in palabras_clave.items():
        if palabra in nombre_limpio:
            return estado

    if len(nombre_limpio) < 3 or any(
        palabra in nombre_limpio for palabra in ["unidad", "medicina", "familiar"]
    ):
        return "Sin estado"

    return nombre.strip().title()
