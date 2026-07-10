from sqlalchemy import text
import sys

sys.path.append("/app")
from app.core.database import SessionLocal

db = SessionLocal()
try:
    print("Querying schedules table...")
    sql = """
    SELECT s.id, t.task_name, o.order_num, s.start_date, s.end_date 
    FROM schedules s
    JOIN task t ON t.task_id = s.task_id
    JOIN orders o ON o.order_id = s.order_id
    ORDER BY s.start_date DESC
    LIMIT 5
    """
    rows = db.execute(text(sql)).mappings().all()
    print("Latest 5 schedules in Database:")
    for row in rows:
        print(f"ID: {row['id']}, Task: {row['task_name']}, Order: {row['order_num']}, Start: {row['start_date']}, End: {row['end_date']}")
except Exception as e:
    print("❌ Error:", str(e))
finally:
    db.close()
