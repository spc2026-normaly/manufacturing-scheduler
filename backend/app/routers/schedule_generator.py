import os
import json
import uuid
import pdfplumber
import openpyxl
from io import BytesIO
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from openai import OpenAI
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.config import settings
from app.database import get_db
from app.models.document import Document
from app.models.employee import Employee
from app.routers.auth import get_current_employee
from app.services.r2_service import download_file_from_r2, list_r2_objects

router = APIRouter(prefix="/api/schedule", tags=["Schedule Generator"])
client = OpenAI(api_key=settings.OPENAI_API_KEY)

class GenerateRequest(BaseModel):
    file_ids: List[str]

def extract_text_from_pdf(file_path: str) -> str:
    text_content = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text_content += page.extract_text() or ""
    return text_content

def extract_text_from_excel(file_path: str) -> str:
    wb = openpyxl.load_workbook(file_path, data_only=True)
    text_content = ""
    for sheet in wb.worksheets:
        text_content += f"\n[시트: {sheet.title}]\n"
        for row in sheet.iter_rows(values_only=True):
            row_text = "\t".join([str(cell) if cell is not None else "" for cell in row])
            if row_text.strip():
                text_content += row_text + "\n"
    return text_content

def extract_text_from_bytes(file_bytes: bytes, filename: str) -> str:
    """바이트 데이터에서 텍스트 추출"""
    ext = os.path.splitext(filename)[1].lower()
    
    if ext == ".pdf":
        text_content = ""
        with pdfplumber.open(BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                text_content += page.extract_text() or ""
        return text_content
    
    elif ext in [".xlsx", ".xls"]:
        text_content = ""
        wb = openpyxl.load_workbook(BytesIO(file_bytes), data_only=True)
        for sheet in wb.worksheets:
            text_content += f"\n[시트: {sheet.title}]\n"
            for row in sheet.iter_rows(values_only=True):
                row_text = "\t".join([str(cell) if cell is not None else "" for cell in row])
                if row_text.strip():
                    text_content += row_text + "\n"
        return text_content
    
    elif ext == ".csv":
        return file_bytes.decode('utf-8', errors='ignore')
    
    elif ext in [".txt"]:
        return file_bytes.decode('utf-8', errors='ignore')
    
    else:
        raise ValueError(f"지원하지 않는 형식: {filename}")

@router.post("/generate", summary="업로드된 파일 기반 일정 생성 및 저장")
async def generate_schedule(
    body: GenerateRequest,
    db: Session = Depends(get_db),
    current_emp: Employee = Depends(get_current_employee)
):
    all_text = ""

    for file_id in body.file_ids:
        doc = db.query(Document).filter(
            Document.file_id == file_id,
            Document.uploader == current_emp.emp_id
        ).first()

        if not doc:
            raise HTTPException(status_code=404, detail=f"파일을 찾을 수 없습니다: {file_id}")

        if not os.path.exists(doc.file_path):
            raise HTTPException(status_code=404, detail=f"파일이 서버에 없습니다: {doc.file_name}")

        ext = doc.file_extension.lower()
        if ext == ".pdf":
            file_text = extract_text_from_pdf(doc.file_path)
        elif ext in [".xlsx", ".xls"]:
            file_text = extract_text_from_excel(doc.file_path)
        else:
            raise HTTPException(status_code=400, detail=f"{doc.file_name}: PDF 또는 Excel만 지원합니다.")

        all_text += f"\n\n[파일: {doc.file_name}]\n{file_text}"

    if not all_text.strip():
        raise HTTPException(status_code=400, detail="파일에서 텍스트를 추출할 수 없습니다.")

    tasks = db.execute(text("SELECT task_id, task_name FROM task")).mappings().all()
    task_list = "\n".join([f"- {t['task_id']}: {t['task_name']}" for t in tasks])

    orders = db.execute(text("SELECT order_id, order_num FROM orders")).mappings().all()
    order_list = "\n".join([f"- {o['order_id']}: {o['order_num']}" for o in orders])

    prompt = """다음은 제조 공장의 생산 관련 문서들입니다. 이 문서들을 분석하여 생산 일정을 JSON 형식으로 생성해주세요.

문서 내용:
""" + all_text[:3000] + """

사용 가능한 task 목록 (반드시 아래 task_id 중에서 선택):
""" + task_list + """

사용 가능한 order 목록 (반드시 아래 order_id 중에서 선택):
""" + order_list + """

다음 형식으로 응답해주세요:
{
  "schedules": [
    {
      "task_id": "tsk_001",
      "order_id": "ord_001",
      "start_date": "2026-07-01",
      "end_date": "2026-07-02",
      "factory": "A동"
    }
  ],
  "summary": "일정 요약 설명"
}

JSON만 응답하고 다른 텍스트는 포함하지 마세요."""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )

    result_text = response.choices[0].message.content.strip()
    result_text = result_text.replace("```json", "").replace("```", "").strip()

    try:
        result = json.loads(result_text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI 응답을 파싱할 수 없습니다.")

    saved = []
    for s in result.get("schedules", []):
        schedule_id = f"sch_{uuid.uuid4().hex[:8]}"
        try:
            db.execute(
                text("""
                    INSERT INTO schedules (id, task_id, order_id, start_date, end_date, factory)
                    VALUES (:id, :task_id, :order_id, :start_date, :end_date, :factory)
                """),
                {
                    "id": schedule_id,
                    "task_id": s["task_id"],
                    "order_id": s["order_id"],
                    "start_date": s["start_date"],
                    "end_date": s["end_date"],
                    "factory": s.get("factory", "A동"),
                }
            )
            saved.append(schedule_id)
        except Exception:
            continue

    db.commit()

    return {
        "message": f"일정 {len(saved)}개가 생성되었습니다.",
        "summary": result.get("summary", ""),
        "saved_count": len(saved)
    }


@router.post("/generate-from-r2", summary="R2 클라우드 문서 기반 일정 생성")
async def generate_schedule_from_r2(
    prefix: str = "safety_manage/",
    db: Session = Depends(get_db),
    current_emp: Employee = Depends(get_current_employee)
):
    """R2에 있는 문서들을 읽어서 일정 생성 및 저장"""
    try:
        # R2에서 파일 목록 조회
        r2_files = list_r2_objects(prefix)
        
        if not r2_files:
            raise HTTPException(status_code=404, detail=f"R2 '{prefix}' 폴더에 파일이 없습니다.")
        
        all_text = ""
        
        # R2에서 각 파일 다운로드 및 처리
        for file_info in r2_files:
            try:
                r2_key = file_info["key"]
                filename = file_info["file_name"]
                
                # R2에서 파일 다운로드
                file_bytes = download_file_from_r2(r2_key)
                
                # 파일 파싱
                file_text = extract_text_from_bytes(file_bytes, filename)
                all_text += f"\n\n[파일: {filename}]\n{file_text}"
                
            except Exception as e:
                print(f"⚠️ 파일 처리 오류 ({file_info['file_name']}): {str(e)}")
                continue
        
        if not all_text.strip():
            raise HTTPException(status_code=400, detail="파일에서 텍스트를 추출할 수 없습니다.")
        
        # task, order 목록 조회
        tasks = db.execute(text("SELECT task_id, task_name FROM task")).mappings().all()
        task_list = "\n".join([f"- {t['task_id']}: {t['task_name']}" for t in tasks])
        
        orders = db.execute(text("SELECT order_id, order_num FROM orders")).mappings().all()
        order_list = "\n".join([f"- {o['order_id']}: {o['order_num']}" for o in orders])
        
        # GPT 프롬프트
        prompt = f"""다음은 제조 공장의 생산 관련 문서들입니다. 이 문서들을 분석하여 생산 일정을 JSON 형식으로 생성해주세요.

문서 내용:
{all_text[:3000]}

사용 가능한 task 목록:
{task_list}

사용 가능한 order 목록:
{order_list}

다음 형식으로 JSON만 응답하세요:
{{
  "schedules": [
    {{
      "task_id": "tsk_001",
      "order_id": "ord_001",
      "start_date": "2026-07-01",
      "end_date": "2026-07-02",
      "factory": "A동"
    }}
  ],
  "summary": "생성된 일정 요약"
}}"""
        
        # GPT API 호출
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        
        result_text = response.choices[0].message.content.strip()
        result_text = result_text.replace("```json", "").replace("```", "").strip()
        
        try:
            result = json.loads(result_text)
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=500, detail=f"AI 응답 파싱 실패: {str(e)}")
        
        # DB에 일정 저장
        saved = []
        for s in result.get("schedules", []):
            schedule_id = f"sch_{uuid.uuid4().hex[:8]}"
            try:
                db.execute(
                    text("""
                        INSERT INTO schedules (id, task_id, order_id, start_date, end_date, factory)
                        VALUES (:id, :task_id, :order_id, :start_date, :end_date, :factory)
                    """),
                    {
                        "id": schedule_id,
                        "task_id": s["task_id"],
                        "order_id": s["order_id"],
                        "start_date": s["start_date"],
                        "end_date": s["end_date"],
                        "factory": s.get("factory", "A동"),
                    }
                )
                saved.append(schedule_id)
            except Exception as e:
                print(f"❌ DB 저장 오류: {str(e)}")
                continue
        
        db.commit()
        
        return {
            "message": f"✅ R2에서 {len(r2_files)}개 파일을 읽어 일정 {len(saved)}개가 생성되었습니다.",
            "summary": result.get("summary", ""),
            "file_count": len(r2_files),
            "saved_count": len(saved),
            "saved_ids": saved
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"일정 생성 실패: {str(e)}")