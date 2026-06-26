import os

filepath = r"c:\Users\adity\OneDrive\Desktop\RC_1\colortek_backend\app\routers\fg_rout.py"
if os.path.exists(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    for i, line in enumerate(lines):
        if "recalculate-stock" in line or "recalculate_stock" in line or "recalculateGoods" in line:
            print(f"{i+1}: {line.strip()}")
else:
    print("File not found")
