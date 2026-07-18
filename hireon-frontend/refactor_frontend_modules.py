import os
import shutil
import re

frontend_dir = r"e:\BrainerHub Internship\hireon-ai\hireon-frontend\src"

moves = [
    ("pages/interviewer", "modules/interviewer/pages"),
    ("pages/portal", "modules/portal/pages"),
    ("pages/admin", "modules/admin/pages"),
    ("pages/super_admin", "modules/super_admin/pages"),
    
    ("components/PreScreening", "modules/interviewer/components/PreScreening"),
    ("components/portal", "modules/portal/components"),
    ("components/superAdmin", "modules/super_admin/components"),
    ("components/admin", "modules/admin/components"),
]

for src_rel, dst_rel in moves:
    src = os.path.join(frontend_dir, *src_rel.split("/"))
    dst = os.path.join(frontend_dir, *dst_rel.split("/"))
    if os.path.exists(src):
        os.makedirs(dst, exist_ok=True)
        for filename in os.listdir(src):
            src_path = os.path.join(src, filename)
            dst_path = os.path.join(dst, filename)
            if not os.path.exists(dst_path):
                shutil.move(src_path, dst_path)
        if not os.listdir(src):
            os.rmdir(src)

replacements = [
    (r'@/pages/interviewer', r'@/modules/interviewer/pages'),
    (r'@/pages/portal', r'@/modules/portal/pages'),
    (r'@/pages/admin', r'@/modules/admin/pages'),
    (r'@/pages/super_admin', r'@/modules/super_admin/pages'),
    
    (r'@/components/PreScreening', r'@/modules/interviewer/components/PreScreening'),
    (r'@/components/portal', r'@/modules/portal/components'),
    (r'@/components/superAdmin', r'@/modules/super_admin/components'),
    (r'@/components/admin', r'@/modules/admin/components'),
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
