import os
import shutil
import re

frontend_dir = r"e:\\projects\\hybent-hiring-ai\hybent-hiring-frontend\src"

# Source directories
src_pages_recruiter = os.path.join(frontend_dir, "pages", "recruiter")
src_components_recruiter = os.path.join(frontend_dir, "components", "recruiter")

# Destination directories
dest_modules_recruiter_pages = os.path.join(frontend_dir, "modules", "recruiter", "pages")
dest_modules_recruiter_components = os.path.join(frontend_dir, "modules", "recruiter", "components")

# Ensure destination exists
os.makedirs(dest_modules_recruiter_pages, exist_ok=True)
os.makedirs(dest_modules_recruiter_components, exist_ok=True)

# Move files from pages/recruiter
if os.path.exists(src_pages_recruiter):
    for filename in os.listdir(src_pages_recruiter):
        src_path = os.path.join(src_pages_recruiter, filename)
        dst_path = os.path.join(dest_modules_recruiter_pages, filename)
        if not os.path.exists(dst_path):
            shutil.move(src_path, dst_path)
    # Remove the old directory if empty
    if not os.listdir(src_pages_recruiter):
        os.rmdir(src_pages_recruiter)

# Move files from components/recruiter
if os.path.exists(src_components_recruiter):
    for filename in os.listdir(src_components_recruiter):
        src_path = os.path.join(src_components_recruiter, filename)
        dst_path = os.path.join(dest_modules_recruiter_components, filename)
        if not os.path.exists(dst_path):
            shutil.move(src_path, dst_path)
    if not os.listdir(src_components_recruiter):
        os.rmdir(src_components_recruiter)

replacements = [
    (r'@/pages/recruiter', r'@/modules/recruiter/pages'),
    (r'@/components/recruiter', r'@/modules/recruiter/components')
]

count = 0
for root, dirs, files in os.walk(frontend_dir):
    for file in files:
        if file.endswith((".tsx", ".ts", ".css")):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
            except Exception:
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
