import boto3
import os
import sys

sys.path.append("/app")
from app.core.config import settings

s3 = boto3.client(
    "s3",
    endpoint_url=settings.R2_ENDPOINT,
    aws_access_key_id=settings.R2_ACCESS_KEY_ID,
    aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
    region_name="auto",
)

bucket = settings.R2_BUCKET_NAME

try:
    print("Copying rag-docs/장비정보.csv to schedule-data-input/장비정보.csv...")
    s3.copy_object(
        Bucket=bucket,
        CopySource={'Bucket': bucket, 'Key': 'rag-docs/장비정보.csv'},
        Key='schedule-data-input/장비정보.csv'
    )
    print("✅ Copy completed successfully!")
except Exception as e:
    print("❌ Failed to copy object:", str(e))
