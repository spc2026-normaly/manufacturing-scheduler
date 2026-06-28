from sqlalchemy import text
import sys
from collections import defaultdict

sys.path.append("/app")
from app.core.database import SessionLocal

db = SessionLocal()
try:
    # Query all schedules with assignments
    sql = """
    SELECT s.id, t.task_name, o.order_num, s.start_date, s.end_date, emp.emp_name
    FROM schedules s
    JOIN task t ON t.task_id = s.task_id
    JOIN orders o ON o.order_id = s.order_id
    JOIN schedule_assignments sa ON sa.id = s.id AND sa.task_id = s.task_id AND sa.order_id = s.order_id
    JOIN employees emp ON emp.emp_id = sa.user_id
    ORDER BY emp.emp_name, s.start_date
    """
    rows = db.execute(text(sql)).mappings().all()
    
    # Check overlap for each employee
    worker_schedules = defaultdict(list)
    for row in rows:
        worker_schedules[row['emp_name']].append({
            'id': row['id'],
            'task': row['task_name'],
            'order': row['order_num'],
            'start': row['start_date'],
            'end': row['end_date']
        })
        
    overlaps_found = 0
    print("Checking overlapping schedules per worker...")
    for worker_name, scheds in worker_schedules.items():
        # Sort by start time
        scheds_sorted = sorted(scheds, key=lambda x: x['start'])
        for i in range(len(scheds_sorted) - 1):
            curr = scheds_sorted[i]
            nxt = scheds_sorted[i+1]
            
            # If next starts before current ends
            if nxt['start'] < curr['end']:
                print(f"⚠️ Overlap detected for [{worker_name}]:")
                print(f"  1. ID: {curr['id']}, Task: {curr['task']}, Order: {curr['order']}, Range: {curr['start']} ~ {curr['end']}")
                print(f"  2. ID: {nxt['id']}, Task: {nxt['task']}, Order: {nxt['order']}, Range: {nxt['start']} ~ {nxt['end']}")
                overlaps_found += 1
                
    if overlaps_found == 0:
        print("✅ No overlapping schedules found for any worker in the Database!")
    else:
        print(f"❌ Total overlap count: {overlaps_found}")
        
except Exception as e:
    print("❌ Error:", str(e))
finally:
    db.close()
