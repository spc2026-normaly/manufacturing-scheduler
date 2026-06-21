from __future__ import annotations

import mimetypes
import os
from functools import lru_cache
from typing import BinaryIO

import boto3
from botocore.client import Config

from app.config import settings


def _require_r2_settings() -> None:
    required = {
        "R2_BUCKET_NAME": settings.R2_BUCKET_NAME,
        "R2_ENDPOINT": settings.R2_ENDPOINT,
        "R2_ACCESS_KEY_ID": settings.R2_ACCESS_KEY_ID,
        "R2_SECRET_ACCESS_KEY": settings.R2_SECRET_ACCESS_KEY,
    }
    missing = [key for key, value in required.items() if not value]
    if missing:
        raise RuntimeError(f"R2 환경변수가 누락되었습니다: {', '.join(missing)}")


@lru_cache(maxsize=1)
def get_r2_client():
    _require_r2_settings()
    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


def normalize_prefix(prefix: str) -> str:
    return prefix.rstrip("/") + "/"


def build_r2_key(filename: str, prefix: str) -> str:
    clean_name = os.path.basename(filename)
    return f"{normalize_prefix(prefix)}{clean_name}"


def upload_fileobj_to_r2(file_obj: BinaryIO, r2_key: str, content_type: str | None = None) -> None:
    client = get_r2_client()
    extra_args: dict[str, str] = {}
    if content_type:
        extra_args["ContentType"] = content_type
    client.upload_fileobj(
        file_obj,
        settings.R2_BUCKET_NAME,
        r2_key,
        ExtraArgs=extra_args if extra_args else None,
    )


def upload_bytes_to_r2(data: bytes, r2_key: str, content_type: str | None = None) -> None:
    client = get_r2_client()
    extra_args: dict[str, str] = {}
    if content_type:
        extra_args["ContentType"] = content_type
    client.put_object(
        Bucket=settings.R2_BUCKET_NAME,
        Key=r2_key,
        Body=data,
        **extra_args,
    )


def download_file_from_r2(r2_key: str) -> bytes:
    client = get_r2_client()
    response = client.get_object(Bucket=settings.R2_BUCKET_NAME, Key=r2_key)
    return response["Body"].read()


def list_r2_objects(prefix: str) -> list[dict]:
    client = get_r2_client()
    normalized = normalize_prefix(prefix)
    continuation_token: str | None = None
    objects: list[dict] = []

    while True:
        params = {"Bucket": settings.R2_BUCKET_NAME, "Prefix": normalized}
        if continuation_token:
            params["ContinuationToken"] = continuation_token

        response = client.list_objects_v2(**params)
        for item in response.get("Contents", []):
            key = item["Key"]
            if key.endswith("/"):
                continue
            objects.append(
                {
                    "key": key,
                    "file_name": key.split("/")[-1],
                    "size": item["Size"],
                    "last_modified": item["LastModified"],
                    "etag": item.get("ETag", "").replace('"', ""),
                }
            )

        if not response.get("IsTruncated"):
            break
        continuation_token = response.get("NextContinuationToken")

    return objects


def guess_content_type(filename: str) -> str | None:
    guessed, _ = mimetypes.guess_type(filename)
    return guessed
