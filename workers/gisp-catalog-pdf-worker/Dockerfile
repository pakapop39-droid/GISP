FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    qpdf clamav clamav-freshclam poppler-utils tesseract-ocr tesseract-ocr-eng tesseract-ocr-chi-sim \
    && freshclam \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --create-home worker \
    && mkdir -p /tmp/gisp-worker \
    && chown -R worker:worker /tmp/gisp-worker /var/lib/clamav
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
RUN chmod 0555 /app/app/entrypoint.sh && chown -R worker:worker /app
USER 10001:10001
ENV PORT=8080 PYTHONUNBUFFERED=1 TMPDIR=/tmp/gisp-worker
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD ["python","-c","from app.main import dependency_health; dependency_health()"]
CMD ["/app/app/entrypoint.sh"]
