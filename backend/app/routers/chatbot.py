import csv
import io
import uuid
import os
from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import FileResponse
from openai import OpenAI
from app.config import settings
from app.schemas.chatbot import ChatResponse

router = APIRouter(prefix="/api", tags=["chatbot"])
client = OpenAI(api_key=settings.OPENAI_API_KEY)

UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/chatbot", response_model=ChatResponse, summary="챗봇 메시지 처리")
async def chat(
    message: str = Form(...),
    file: UploadFile = File(None)
) -> ChatResponse:
    file_content = ""

    if file and file.filename:
        content = await file.read()
        ext = os.path.splitext(file.filename)[1].lower()

        if ext == ".csv":
            decoded = ""
            for encoding in ["utf-8-sig", "utf-8", "cp949", "euc-kr"]:
                try:
                    decoded = content.decode(encoding)
                    break
                except UnicodeDecodeError:
                    continue
            if not decoded:
                decoded = content.decode("cp949", errors="ignore")
            file_content = f"\n\n[첨부 CSV: {file.filename}]\n{decoded[:3000]}"

    prompt = f"""사용자 요청: {message}
{file_content}

CSV 파일이 첨부되고 수정 요청이 있는 경우:
1. 수정된 전체 CSV 데이터를 반환해주세요
2. 응답 형식:
REPLY: (사용자에게 보여줄 메시지)
CSV:
(수정된 CSV 내용, 헤더 포함)

CSV 수정 요청이 없는 일반 질문은 그냥 답변해주세요."""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )

    result = response.choices[0].message.content.strip()

    if "CSV:" in result and file and file.filename:
        parts = result.split("CSV:", 1)
        reply_text = parts[0].replace("REPLY:", "").strip()
        csv_data = parts[1].strip()

        filename = f"modified_{uuid.uuid4().hex[:8]}.csv"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "w", encoding="utf-8-sig") as f:
            f.write(csv_data)

        download_url = f"/api/chatbot/download/{filename}"
        reply_text += f"\n\n📥 [수정된 파일 다운로드]({download_url})"
        return ChatResponse(reply=reply_text, source="gpt")

    return ChatResponse(reply=result, source="gpt")


@router.get("/chatbot/download/{filename}", summary="수정된 파일 다운로드")
def download_file(filename: str):
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(filepath):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(path=filepath, filename=filename, media_type="text/csv")