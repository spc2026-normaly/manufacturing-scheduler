from app.core.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
query_str = """
SELECT content, chunk_index
FROM document_chunks 
WHERE content LIKE :term1 OR content LIKE :term2 OR content LIKE :term3 OR content LIKE :term4
ORDER BY chunk_index
"""
rows = db.execute(
    text(query_str),
    {"term1": "%출입권한%", "term2": "%필수교육%", "term3": "%배치규정%", "term4": "%중요규정%"}
).mappings().all()

print(f"Found {len(rows)} matching chunks:")
for idx, r in enumerate(rows):
    print(f"\n[Index {r['chunk_index']}]")
    print(r["content"])
    print("=" * 60)
