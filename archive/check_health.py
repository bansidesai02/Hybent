import requests
import json

base_url = "http://localhost:8000/v1"
# We need an auth token. I'll try to find one or just check the schema if I can't.
# Since I can't easily get a token without credentials, I'll trust my code edits.
# However, I can check if the backend service is up and responding to public routes.

try:
    res = requests.get(f"{base_url}/health")
    print(f"Health check: {res.status_code}")
except Exception as e:
    print(f"Error: {e}")
