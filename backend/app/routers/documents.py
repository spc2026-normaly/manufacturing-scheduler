from urllib.parse import quote
from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import (
    APIRouter,
    UploadFile, File, Depends,
    HTTPException,
    Query,
    Response,
    status,
)

from app.database import get_db
from app.models.document import Document
from app.routers.auth import Permission, PermissionChecker, TokenData
from app.services.document_service import (
    DocumentCategory,
    get_document_bytes,
    process_uploaded_document,
    sync_r2_documents,
)
from app.services.r2_service import delete_file_from_r2

router = APIRouter(prefix="/api/documents", tags=["Documents"])

@router.get("", summary="문서 목록 조회")
def get_documents(
    db: Session = Depends(get_db),
    current_emp: TokenData = Depends(PermissionChecker(Permission.DOCUMENT_READ))
):
    """문서 목록 조회"""
    return db.execute(select(Document)).scalars().all()

@router.post("/upload", summary="문서 업로드")
async def upload_document(
    file: UploadFile = File(...),
    category: DocumentCategory = Query(default="rag"),
    db: Session = Depends(get_db),
    current_emp: TokenData = Depends(PermissionChecker(Permission.DOCUMENT_WRITE)),
    current_claims = Depends(PermissionChecker(Permission.DOCUMENT_WRITE)),
):
    from app.models.employee import Employee
    emp = db.query(Employee).filter(Employee.login_id == current_claims.login_id).first()
    
    """파일 업로드 + R2 저장 + 벡터 임베딩 처리 + R2 문서 동기화"""
    res = await process_uploaded_document(
        db,
        uploader=emp.emp_id,
        upload=file,
        category=category,
    )
    
    # 파일 업로드 성공 후 R2 문서 리스트 자동 동기화
    try:
        sync_r2_documents(db, uploader=current_emp.emp_id)
    except Exception as e:
        print(f"⚠️ Failed to sync documents after upload: {str(e)}")
        
    return res

@router.post("/sync-r2", summary="R2 문서 동기화")
def sync_documents_from_r2(
    db: Session = Depends(get_db),
    current_emp: TokenData = Depends(PermissionChecker(Permission.DOCUMENT_WRITE)),
):
    """R2 클라우드페어의 모든 파일을 DB와 동기화 (추가/업데이트/삭제)"""
    return sync_r2_documents(db, uploader=current_emp.emp_id)

@router.get("/{file_id}", summary="문서 단건 조회")
def get_document(
    file_id: str,
    db: Session = Depends(get_db),
    current_emp: TokenData = Depends(PermissionChecker(Permission.DOCUMENT_READ))
):
    """특정 파일ID의 문서 메타데이터 조회"""
    doc = db.query(Document).filter(Document.file_id == file_id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="문서를 찾을 수 없습니다."
        )
    return doc

@router.get("/{file_id}/download", summary="문서 다운로드")
def download_document(
    file_id: str,
    db: Session = Depends(get_db),
    current_emp: TokenData = Depends(PermissionChecker(Permission.DOCUMENT_READ))
):
    """R2에서 파일 다운로드 (바이너리 응답)"""
    doc, file_bytes = get_document_bytes(db=db, file_id=file_id)
    encoded_filename = quote(doc.file_name)
    return Response(
        content=file_bytes,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"},
    )

@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT, summary="문서 삭제")
def delete_document(
    file_id: str,
    db: Session = Depends(get_db),
    current_emp: TokenData = Depends(PermissionChecker(Permission.DOCUMENT_WRITE))
):
    """문서 메타데이터 DB 및 R2 저장소에서 삭제"""
    doc = db.query(Document).filter(
        Document.file_id == file_id,
        Document.uploader == current_emp.emp_id
    ).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="문서를 찾을 수 없거나 삭제 권한이 없습니다."
        )
    
    # R2 저장소에서 파일 삭제
    try:
        delete_file_from_r2(doc.file_path)
    except Exception as e:
        print(f"⚠️ Failed to delete {doc.file_path} from R2: {str(e)}")

    db.delete(doc)
    db.commit()

    # 파일 삭제 성공 후 R2 문서 리스트 자동 동기화
    try:
        sync_r2_documents(db, uploader=current_emp.emp_id)
    except Exception as e:
        print(f"⚠️ Failed to sync documents after delete: {str(e)}")