FROM python:3.12-slim-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg fontconfig fonts-montserrat fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY editor ./editor
COPY static ./static

ENV YT_EDITOR_HOST=0.0.0.0 \
    YT_EDITOR_DATA=/datos \
    YT_EDITOR_NO_BROWSER=1 \
    HF_HOME=/datos/modelos \
    PYTHONUNBUFFERED=1
VOLUME /datos
EXPOSE 8000
CMD ["python", "-m", "editor"]
