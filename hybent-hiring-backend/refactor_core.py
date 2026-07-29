import os
import re

backend_dir = r"e:\BrainerHub Internship\hybent-hiring-ai\hybent-hiring-backend"
core_dir = os.path.join(backend_dir, "app", "core")
os.makedirs(core_dir, exist_ok=True)

files_to_move = ["config.py", "database.py", "celery_app.py"]
for f in files_to_move:
    src = os.path.join(backend_dir, "app", f)
    dst = os.path.join(core_dir, f)
    if os.path.exists(src):
        os.rename(src, dst)
        print(f"Moved {f} to core/")

replacements = [
    (r'from app\.config import', r'from app.core.config import'),
    (r'import app\.config', r'import app.core.config'),
    (r'from app\.database import', r'from app.core.database import'),
    (r'import app\.database', r'import app.core.database'),
    (r'from app\.celery_app import', r'from app.core.celery_app import'),
    (r'import app\.celery_app', r'import app.core.celery_app')
]

count = 0
for root, dirs, files in os.walk(backend_dir):
    if "venv" in root or ".pytest_cache" in root or "__pycache__" in root:
        continue
    for file in files:
        if file.endswith(".py"):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                try:
                    content = f.read()
                except UnicodeDecodeError:
                    continue
            
            new_content = content
            for old, new in replacements:
                new_content = re.sub(old, new, new_content)
                
            if new_content != content:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                count += 1
                print(f"Updated imports in {path}")

print(f"Total updated: {count} files")
