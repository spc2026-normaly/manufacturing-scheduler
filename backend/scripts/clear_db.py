from sqlalchemy import text
import sys

sys.path.append("/app")
from app.core.database import SessionLocal

db = SessionLocal()
try:
    print("🧹 Cleaning database schedules, assignments, and orders...")
    db.execute(text("DELETE FROM schedule_assignments"))
    db.execute(text("DELETE FROM schedules"))
    db.execute(text("DELETE FROM orders"))
    db.commit()
    print("✅ Clear complete!")
except Exception as e:
    db.rollback()
    print("❌ Failed to clear database:", str(e))
finally:
    db.close()
