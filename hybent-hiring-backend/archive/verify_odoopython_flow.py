import httpx
import json

def main():
    client = httpx.Client()
    
    # 1. Login
    print("Logging in...")
    login_resp = client.post(
        "http://localhost:8000/v1/auth/login",
        json={"email": "recruiter@brainerhub.com", "password": "password123"}
    )
    if login_resp.status_code != 200:
        print("Login failed:", login_resp.text)
        return
        
    res_data = login_resp.json()
    token = res_data["data"]["access_token"]
    
    # 2. Query
    message = "Show candidates for the OdooPython job"
    print(f"Sending message: '{message}'")
    
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "message": message,
        "history": []
    }
    
    with client.stream("POST", "http://localhost:8000/v1/copilot/chat", json=payload, headers=headers, timeout=30.0) as r:
        for line in r.iter_lines():
            if line.startswith("data: "):
                data = json.loads(line[6:])
                if data.get("type") == "chunk":
                    print(data.get("content"), end="", flush=True)
                elif data.get("type") == "approval":
                    print("\n[Approval]:", data.get("pending_tool_call"))
                elif data.get("type") == "meta":
                    pass
                elif data.get("type") == "done":
                    print("\n--- Done ---")

if __name__ == "__main__":
    main()
