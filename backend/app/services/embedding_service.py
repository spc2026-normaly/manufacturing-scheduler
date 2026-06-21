from __future__ import annotations

from io import BytesIO

from langchain_text_splitters import RecursiveCharacterTextSplitter
from openai import OpenAI
from pypdf import PdfReader
from docx import Document as DocxDocument

from app.config import settings


SUPPORTED_EMBED_EXTENSIONS = {"pdf", "txt", "csv", "md", "docx"}


def is_embedding_target(file_extension: str) -> bool:
    return file_extension.lower() in SUPPORTED_EMBED_EXTENSIONS


def extract_text_from_bytes(file_bytes: bytes, file_extension: str) -> str:
    ext = file_extension.lower()

    if ext == "pdf":
        reader = PdfReader(BytesIO(file_bytes))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages).strip()

    if ext == "docx":
        doc = DocxDocument(BytesIO(file_bytes))
        return "\n".join(paragraph.text for paragraph in doc.paragraphs).strip()

    if ext in {"txt", "csv", "md"}:
        for encoding in ("utf-8", "cp949", "euc-kr"):
            try:
                return file_bytes.decode(encoding)
            except UnicodeDecodeError:
                continue
        return file_bytes.decode("utf-8", errors="ignore")

    raise ValueError(f"지원하지 않는 텍스트 추출 확장자입니다: {file_extension}")


def split_text_to_chunks(text: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.RAG_CHUNK_SIZE,
        chunk_overlap=settings.RAG_CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = [chunk.strip() for chunk in splitter.split_text(text)]
    return [chunk for chunk in chunks if chunk]


def create_embeddings(chunks: list[str]) -> list[list[float]]:
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY가 설정되지 않았습니다.")

    if not chunks:
        return []

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    response = client.embeddings.create(
        model=settings.OPENAI_EMBEDDING_MODEL,
        input=chunks,
    )
    return [item.embedding for item in response.data]


def create_query_embedding(query: str) -> list[float]:
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY가 설정되지 않았습니다.")

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    response = client.embeddings.create(
        model=settings.OPENAI_EMBEDDING_MODEL,
        input=[query],
    )
    return response.data[0].embedding


def chunk_and_embed(file_bytes: bytes, file_extension: str) -> tuple[list[str], list[list[float]]]:
    text = extract_text_from_bytes(file_bytes=file_bytes, file_extension=file_extension)
    chunks = split_text_to_chunks(text)
    embeddings = create_embeddings(chunks)
    return chunks, embeddings
