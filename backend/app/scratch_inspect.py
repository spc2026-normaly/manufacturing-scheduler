import os
import boto3
from dotenv import load_dotenv
import csv
import io

# Load .env
env_path = "/app/.env"
if not os.path.exists(env_path):
    env_path = "/.env"
load_dotenv(env_path)

s3 = boto3.client(
    "s3",
    endpoint_url=os.getenv("R2_ENDPOINT"),
    aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
    region_name="auto",
)

bucket = os.getenv("R2_BUCKET_NAME")

files = [
    "schedule-data-input/생산계획서.csv",
    "schedule-data-input/장비정보.csv",
    "schedule-data-input/직원교육이력.csv",
    "schedule-data-input/테스트및공정목록.csv"
]

for f in files:
    print("\n" + "="*60)
    print(f"📄 Inspecting R2 File: {f}")
    print("="*60)
    try:
        response = s3.get_object(Bucket=bucket, Key=f)
        content = response["Body"].read()
        
        # Try decoding
        decoded = None
        for enc in ["utf-8-sig", "utf-8", "cp949", "euc-kr"]:
            try:
                decoded = content.decode(enc)
                break
            except Exception:
                continue
        if decoded is None:
            decoded = content.decode("utf-8", errors="ignore")
            
        f_in = io.StringIO(decoded)
        reader = csv.reader(f_in)
        headers = next(reader)
        print("Headers:", headers)
        
        print("Rows:")
        count = 0
        for row in reader:
            print(row)
            count += 1
            if count >= 3:
                break
    except Exception as e:
        print(f"Error inspecting {f}: {e}")
