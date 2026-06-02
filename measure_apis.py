import time
import urllib.request
import urllib.parse
import json

BASE_URL = "https://hireon-ai.onrender.com"

def measure_request(method, path, headers=None, body=None):
    url = f"{BASE_URL}{path}"
    data = None
    if body:
        data = json.dumps(body).encode('utf-8')
    
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Content-Type', 'application/json')
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
            
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read()
            elapsed = time.perf_counter() - start
            return elapsed, json.loads(content.decode('utf-8')), resp.status
    except Exception as e:
        elapsed = time.perf_counter() - start
        return elapsed, str(e), getattr(e, 'code', 500)

def main():
    print("Testing live API server performance...")
    
    # 1. Login
    login_body = {
        "email": "admin@brainerhub.com",
        "password": "password123"
    }
    print(f"\n--- Testing Login API ---")
    elapsed_login, resp_login, code_login = measure_request("POST", "/v1/auth/login", body=login_body)
    print(f"Status Code: {code_login}")
    print(f"Time Elapsed: {elapsed_login:.4f} seconds")
    
    if code_login != 200:
        print("Login failed, aborting further measurements.")
        print(f"Response: {resp_login}")
        return
        
    token_data = resp_login.get("data", {})
    token = token_data.get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Get User Me
    print(f"\n--- Testing Me API ---")
    elapsed_me, resp_me, code_me = measure_request("GET", "/v1/auth/me", headers=headers)
    print(f"Status Code: {code_me}")
    print(f"Time Elapsed: {elapsed_me:.4f} seconds")
    
    # 3. Get Overview (Dashboard)
    print(f"\n--- Testing Overview (Analytics) API ---")
    elapsed_overview, _, code_overview = measure_request("GET", "/v1/analytics/overview", headers=headers)
    print(f"Status Code: {code_overview}")
    print(f"Time Elapsed: {elapsed_overview:.4f} seconds")
    
    # 4. Get Notifications List
    print(f"\n--- Testing Notifications List API ---")
    elapsed_notifs, _, code_notifs = measure_request("GET", "/v1/notifications", headers=headers)
    print(f"Status Code: {code_notifs}")
    print(f"Time Elapsed: {elapsed_notifs:.4f} seconds")
    
    # 5. Get Interviews List
    print(f"\n--- Testing Interviews List API ---")
    elapsed_interviews, _, code_interviews = measure_request("GET", "/v1/interviews", headers=headers)
    print(f"Status Code: {code_interviews}")
    print(f"Time Elapsed: {elapsed_interviews:.4f} seconds")
    
    # 6. Get Activities Feed
    print(f"\n--- Testing Activities List API ---")
    elapsed_activities, _, code_activities = measure_request("GET", "/v1/activities?limit=4", headers=headers)
    print(f"Status Code: {code_activities}")
    print(f"Time Elapsed: {elapsed_activities:.4f} seconds")

if __name__ == "__main__":
    main()
