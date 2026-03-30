import asyncio
import os
import sys

# Add app directory to path
sys.path.append(os.getcwd())

from app.database import AsyncSessionLocal

async def task_with_loop(task_id):
    print(f"Starting task {task_id} in loop {id(asyncio.get_running_loop())}")
    async with AsyncSessionLocal() as session:
        # Just a simple query to trigger connection
        from sqlalchemy import text
        await session.execute(text("SELECT 1"))
        print(f"Task {task_id} completed successfully")

def run_task(task_id):
    print(f"\n--- Running Task {task_id} ---")
    asyncio.run(task_with_loop(task_id))

if __name__ == "__main__":
    # Simulate Celery worker running multiple tasks in sequence with asyncio.run()
    try:
        run_task(1)
        run_task(2)
        print("\nSUCCESS: Both tasks completed successfully in different loops!")
    except Exception as e:
        print(f"\nFAILURE: {e}")
        import traceback
        traceback.print_exc()
