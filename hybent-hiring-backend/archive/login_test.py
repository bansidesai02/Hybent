import httpx, json
r = httpx.post('http://localhost:8000/v1/auth/login', json={"email": "admin@hirreon.com", "password": "admin"})
print(r.text)
