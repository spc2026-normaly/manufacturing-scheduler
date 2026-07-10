"""R2 클라우드페어 버킷의 전체 폴더/파일 구조 확인 스크립트"""

import boto3
from dotenv import load_dotenv
import os
import sys

# 절대 경로로 .env 로드
env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path)

print(f"📁 Loading .env from: {env_path}")
print(f"   R2_BUCKET_NAME: {os.getenv('R2_BUCKET_NAME')}")
print(f"   R2_SAFETY_MANAGE_PREFIX: {os.getenv('R2_SAFETY_MANAGE_PREFIX')}")
print()

# R2 S3 클라이언트 초기화
s3 = boto3.client(
    "s3",
    endpoint_url=os.getenv("R2_ENDPOINT"),
    aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
    region_name="auto",
)

bucket = os.getenv("R2_BUCKET_NAME")

# 루트 레벨 폴더 나열
print("=" * 60)
print("🔍 R2 버킷의 모든 객체 (루트 레벨):")
print("=" * 60)

response = s3.list_objects_v2(Bucket=bucket, Delimiter="/")
if "CommonPrefixes" in response:
    for prefix in response["CommonPrefixes"]:
        print(f"📁 {prefix['Prefix']}")
else:
    print("폴더 없음")

print()

# safety_manage 폴더 존재 여부 확인 (여러 가능성 체크)
print("=" * 60)
print("🔍 safety_manage/ 폴더 확인:")
print("=" * 60)

# 가능한 폴더명 변형 확인
prefixes_to_check = [
    "safety_manage/",
    "safety_manage",
    "safety-manage/",
    "safety-manage",
]

for prefix in prefixes_to_check:
    try:
        response = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)
        count = len(response.get("Contents", []))
        print(f"  Prefix '{prefix}': {count} files")
        if count > 0:
            for obj in response["Contents"]:
                print(f"    - {obj['Key']}")
    except Exception as e:
        print(f"  Prefix '{prefix}': ERROR - {e}")

print()

# 버킷 전체 파일 나열
print("=" * 60)
print("📋 R2 버킷의 모든 파일:")
print("=" * 60)

response = s3.list_objects_v2(Bucket=bucket)
all_files = response.get("Contents", [])
print(f"총 {len(all_files)} 개 파일\n")

for obj in all_files:
    print(f"  {obj['Key']} ({obj['Size']} bytes)")
