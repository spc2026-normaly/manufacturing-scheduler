import boto3
import os
import sys

# Load env vars
sys.path.append("/app")
from app.config import settings

print(f"R2_ENDPOINT: {settings.R2_ENDPOINT}")
print(f"R2_BUCKET_NAME: {settings.R2_BUCKET_NAME}")

s3 = boto3.client(
    "s3",
    endpoint_url=settings.R2_ENDPOINT,
    aws_access_key_id=settings.R2_ACCESS_KEY_ID,
    aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
    region_name="auto",
)

bucket = settings.R2_BUCKET_NAME

print("=" * 60)
print("📋 R2 BUCKET FILES:")
print("=" * 60)

try:
    response = s3.list_objects_v2(Bucket=bucket)
    all_files = response.get("Contents", [])
    print(f"Total: {len(all_files)} files\n")
    for obj in all_files:
        print(f"  {obj['Key']} ({obj['Size']} bytes)")
except Exception as e:
    print("❌ Failed to list R2 objects:", str(e))
