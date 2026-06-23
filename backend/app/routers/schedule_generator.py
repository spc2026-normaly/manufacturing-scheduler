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