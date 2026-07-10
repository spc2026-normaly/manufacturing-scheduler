import sys
import os
from sqlalchemy import text

sys.path.append("/app")

from app.core.database import SessionLocal
from app.services.schedule_pipeline.orchestrator import generate_and_upload_schedule
from app.services.schedule_pipeline.csv_io import parse_schedule_csv_directly, download_file_from_r2

db = SessionLocal()
try:
    print("🚀 Running schedule generation pipeline...")
    # 1. Generate schedule and upload to R2
    result = generate_and_upload_schedule(db)
    print("✅ Pipeline result:", result)
    
    # 2. Get reference mapping data
    tasks = db.execute(text("SELECT task_id, task_name FROM task")).mappings().all()
    employees = db.execute(text("SELECT emp_id, login_id, emp_name, emp_role FROM employees")).mappings().all()
    equipments = db.execute(text("SELECT eq_id, eq_name FROM equipments")).mappings().all()
    orders = db.execute(text("SELECT order_id, order_num, product_name FROM orders")).mappings().all()
    
    valid_tasks = {t['task_id'] for t in tasks}
    
    employee_map = {}
    for e in employees:
        emp_id = e['emp_id']
        emp_name = e['emp_name']
        login_id = e['login_id']
        employee_map[emp_id.lower().strip()] = emp_id
        employee_map[emp_name.lower().strip()] = emp_id
        if login_id:
            employee_map[login_id.lower().strip()] = emp_id
            
    equipment_map = {}
    for eq in equipments:
        eq_id = eq['eq_id']
        eq_name = eq['eq_name']
        equipment_map[eq_id.lower().strip()] = eq_id
        equipment_map[eq_name.lower().strip()] = eq_id
        
    order_map = {}
    for o in orders:
        ord_id = o['order_id']
        ord_num = o['order_num']
        order_map[ord_id.lower().strip()] = ord_id
        order_map[ord_num.lower().strip()] = ord_id
        
    # 3. Download the generated CSV from R2
    print("📥 Downloading generated CSV from R2...")
    file_bytes = download_file_from_r2("schedule-data-output/생산일정결과.csv")
    file_text = file_bytes.decode('utf-8-sig', errors='ignore')
    
    # 4. Insert schedules into the database
    print("💾 Inserting schedules into Database...")
    saved_count = parse_schedule_csv_directly(
        file_text,
        db=db,
        employee_map=employee_map,
        equipment_map=equipment_map,
        order_map=order_map,
        valid_tasks=valid_tasks
    )
    print(f"✅ DB Integration complete! Total saved: {saved_count}")
    
except Exception as e:
    print("❌ Failed to execute pipeline and insert:", str(e))
finally:
    db.close()
