# One image, two processes (chosen by the compose command):
#   API + scheduler:  uvicorn voice.api:app --host 0.0.0.0 --port 8100
#   Agent worker:     python -m voice.agent.worker start
FROM python:3.11-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# VAD and turn-detector model weights, baked in so workers start fast.
RUN python -m voice.agent.worker download-files

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8100
CMD ["uvicorn", "voice.api:app", "--host", "0.0.0.0", "--port", "8100"]
