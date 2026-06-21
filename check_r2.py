"""R2 클라우드페어 safety_manage 폴더의 파일 확인 스크립트"""

import boto3
from dotenv import load_dotenv
import os

# .env 파일 로드
load_dotenv()

# R2 S3 클라이언트 초기화
s3 = boto3.client(
    "s3",
    endpoint_url=os.getenv("R2_ENDPOINT"),
    aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
    region_name="auto",
)

bucket = os.getenv("R2_BUCKET_NAME")

# safety_manage 폴더의 모든 파일 확인
response = s3.list_objects_v2(Bucket=bucket, Prefix="safety_manage/")
print("=== safety_manage/ 폴더의 파일들 ===")
if "Contents" in response:
    for obj in response["Contents"]:
        print(f'📄 {obj["Key"]} (Size: {obj["Size"]} bytes)')
else:
    print("파일이 없습니다!")
