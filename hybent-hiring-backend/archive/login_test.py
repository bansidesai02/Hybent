import httpx, os
email = os.getenv("TEST_EMAIL", "admin@hybent.com")
password = os.getenv("TEST_PASSWORD", "SecretPass123!")
r = httpx.post('http://localhost:8000/v1/auth/login', json={"email": email, "password": password})
print(r.text)
