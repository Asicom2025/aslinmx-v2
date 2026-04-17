# slim sobre Debian 12 (tag oficial: slim-bookworm, no bookworm-slim)
FROM python:3.12-slim-bookworm

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

# WeasyPrint requiere GLib/GObject, Pango, Cairo, HarfBuzz, etc.
RUN apt-get update -o Acquire::Retries=5 -o Acquire::http::Timeout=120 \
    && apt-get install -y --no-install-recommends \
       ca-certificates \
       build-essential \
       libpq-dev \
       libcairo2 \
       libpango-1.0-0 \
       libpangocairo-1.0-0 \
       libpangoft2-1.0-0 \
       libgdk-pixbuf-2.0-0 \
       libffi-dev \
       libglib2.0-0 \
       libharfbuzz-subset0 \
       shared-mime-info \
       fonts-dejavu-core \
       libjpeg62-turbo-dev \
       libopenjp2-7-dev \
    && rm -rf /var/lib/apt/lists/*

# Ayuda a WeasyPrint a localizar las librerías compartidas (GObject, Pango)
ENV LD_LIBRARY_PATH=/usr/lib/x86_64-linux-gnu

COPY requirements.txt .
# pip antiguo o red inestable → "from versions: none"; actualizar pip y reintentar
ENV PIP_DEFAULT_TIMEOUT=120
RUN python -m pip install --upgrade pip setuptools wheel \
    && pip install --no-cache-dir --retries 8 -r requirements.txt

COPY . .

EXPOSE 8000

ENV PYTHONPATH=/app

# Inicializar BD una sola vez antes de uvicorn (evita race con --workers)
CMD ["sh", "-c", "python init_db.py && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4"]