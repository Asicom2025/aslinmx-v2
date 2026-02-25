FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# WeasyPrint requiere GLib/GObject, Pango, Cairo, HarfBuzz, etc.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
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
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

ENV PYTHONPATH=/app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]