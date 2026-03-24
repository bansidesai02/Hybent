
import asyncio
from app.celery_app import celery_app

def inspect_celery_tasks():
    print("Inspecting registered Celery tasks...")
    # This might only show tasks registered in the current process
    # But it's a good check for the app instance
    tasks = list(celery_app.tasks.keys())
    print(f"Registered tasks: {tasks}")
    
    expected_tasks = [
        'app.tasks.notifications.send_system_notification',
        'app.tasks.notifications.notify_organization_roles',
        'app.tasks.notifications.notify_interview_team'
    ]
    
    for et in expected_tasks:
        if et in tasks:
            print(f"✓ {et} found.")
        else:
            print(f"✗ {et} NOT found.")

if __name__ == "__main__":
    inspect_celery_tasks()
