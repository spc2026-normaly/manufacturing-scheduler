from typing import List
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import Session
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.services.embedding_service import create_query_embedding
from app.config import settings

def search_safety_rules(db: Session, query: str, top_k: int = 5) -> List[str]:
    """
    Searches safety regulations and RAG documents in the database
    by computing similarity with the query.
    """
    if not query.strip():
        return []
        
    try:
        # Create query embedding using OpenAI
        query_emb = create_query_embedding(query)
        
        # Build query searching documents in safety_manage or rag-docs prefixes
        stmt = (
            select(DocumentChunk.content)
            .join(Document, and_(
                Document.file_id == DocumentChunk.file_id,
                Document.uploader == DocumentChunk.uploader
            ))
            .where(or_(
                Document.file_path.like(f"{settings.R2_RAG_PREFIX.rstrip('/')}/%"),
                Document.file_path.like("safety_manage/%")
            ))
            .order_by(DocumentChunk.embedding.cosine_distance(query_emb))
            .limit(top_k)
        )
        
        rows = db.execute(stmt).scalars().all()
        return list(rows)
    except Exception as e:
        print(f"⚠️ RAG Search Error: {str(e)}")
        return []
