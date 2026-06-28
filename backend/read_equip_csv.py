import boto3
import sys
import io
import pandas as pd

sys.path.append("/app")
from app.config import settings
from app.services.schedule_pipeline.csv_io import decode_csv_bytes

s3 = boto3.client(
    "s3",
    endpoint_url=settings.R2_ENDPOINT,
    aws_access_key_id=settings.R2_ACCESS_KEY_ID,
    aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
    region_name="auto",
)

bucket = settings.R2_BUCKET_NAME

try:
    print("Downloading schedule-data-input/장비정보.csv from R2...")
    obj = s3.get_object(Bucket=bucket, Key="schedule-data-input/장비정보.csv")
    content = obj["Body"].read()
    decoded = decode_csv_bytes(content)
    df = pd.read_csv(io.StringIO(decoded))
    print("Columns:", list(df.columns))
    print("First row:\n", df.head(1))
except Exception as e:
    print("❌ Error:", str(e))
