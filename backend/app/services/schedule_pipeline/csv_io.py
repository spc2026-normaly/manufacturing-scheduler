import os
import re
import csv
import uuid
import io
import pandas as pd
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.services.r2_service import download_file_from_r2, upload_bytes_to_r2

def decode_csv_bytes(content: bytes) -> str:
    """Helper to decode CSV bytes trying multiple Korean/UTF-8 encodings."""
    for enc in ("utf-8-sig", "utf-8", "cp949", "euc-kr"):
        try:
            return content.decode(enc)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="ignore")

def load_input_csvs_from_r2() -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Downloads and parses input CSVs from R2 using Pandas."""
    files = {
        "orders": "schedule-data-input/생산계획서.csv",
        "equipments": "schedule-data-input/장비정보.csv",
        "training": "schedule-data-input/직원교육이력.csv",
        "tasks": "schedule-data-input/테스트및공정목록.csv"
    }
    
    parsed = {}
    for name, key in files.items():
        try:
            content_bytes = download_file_from_r2(key)
            decoded = decode_csv_bytes(content_bytes)
            
            # Determine separator dynamically based on first line
            sep = ','
            first_line = decoded.split('\n')[0] if decoded else ""
            for d in ['\t', ';']:
                if d in first_line:
                    sep = d
                    break
            df = pd.read_csv(io.StringIO(decoded), sep=sep)
            # Clean column names (strip whitespace)
            df.columns = [c.strip() for c in df.columns]
            parsed[name] = df
        except Exception as e:
            raise RuntimeError(f"Failed to load/parse {key} from R2: {str(e)}")
            
    return parsed["orders"], parsed["equipments"], parsed["training"], parsed["tasks"]

def upload_schedule_to_r2(df: pd.DataFrame, filename: str = "생산일정결과.csv"):
    """Saves DataFrame as UTF-8 BOM CSV and uploads to R2 output prefix."""
    csv_buf = io.StringIO()
    df.to_csv(csv_buf, index=False, encoding="utf-8-sig")
    csv_bytes = csv_buf.getvalue().encode("utf-8-sig")
    
    r2_key = f"schedule-data-output/{filename}"
    upload_bytes_to_r2(csv_bytes, r2_key, content_type="text/csv")
    print(f"✅ Uploaded schedule output to R2: {r2_key}")

def find_column(headers: List[str], candidates: List[str]) -> str:
    """Helper to match candidate column names to actual headers."""
    headers_norm = [h.strip().lower() for h in headers]
    for cand in candidates:
        cand_norm = cand.lower().strip()
        if cand_norm in headers_norm:
            idx = headers_norm.index(cand_norm)
            return headers[idx]
            
    for cand in candidates:
        cand_norm = cand.lower().strip()
        for i, h in enumerate(headers_norm):
            if cand_norm in h or h in cand_norm:
                return headers[i]
    return None

def parse_schedule_csv_directly(
    file_text: str,
    db: Session,
    employee_map: dict,
    equipment_map: dict,
    order_map: dict,
    valid_tasks: set
) -> int:
    """
    Parses a schedule CSV file text, inserts/updates orders,
    required equipments, schedules, and schedule assignments.
    Refactored from schedule_generator.py.
    """
    lines = [line.strip() for line in file_text.split('\n') if line.strip()]
    if not lines:
        return 0
    first_line = lines[0]
    delimiter = ','
    for d in ['\t', ';']:
        if d in first_line:
            delimiter = d
            break
            
    f = io.StringIO(file_text)
    reader = csv.DictReader(f, delimiter=delimiter)
    headers = reader.fieldnames
    if not headers:
        return 0
        
    col_order_num = find_column(headers, ["주문번호", "order_num", "order_id"])
    col_task_id = find_column(headers, ["작업ID", "작업id", "task_id", "작업 id"])
    col_start_date = find_column(headers, ["시작일", "start_date", "시작 일", "시작일시"])
    col_end_date = find_column(headers, ["종료일", "end_date", "종료 일", "종료일시"])
    col_factory = find_column(headers, ["공장동", "factory", "공장"])
    col_workers = find_column(headers, ["배정직원", "workers", "employees", "작업자"])
    col_product = find_column(headers, ["제품명", "product_name", "제품"])
    col_count = find_column(headers, ["수량", "order_count", "주문수량"])
    col_due_date = find_column(headers, ["납기일", "due_date", "납기"])
    col_status = find_column(headers, ["납기상태", "order_status", "상태"])
    col_equip = find_column(headers, ["필요장비", "equipments", "equipment", "장비"])
    
    # 기존 일정 및 배정, 주문 데이터 삭제 (새로 적재하기 위해 초기화)
    # 단일 트랜잭션(All-or-Nothing) 유지를 위해 즉시 commit하지 않고, 루프 끝까지 에러 없이 완료된 경우에만 최종 일괄 커밋합니다.
    try:
        # PostgreSQL 외래키 관계상 schedule_assignments -> schedules -> orders 순으로 삭제
        db.execute(text("DELETE FROM schedule_assignments"))
        db.execute(text("DELETE FROM schedules"))
        db.execute(text("DELETE FROM orders"))
        print("🗑️ 기존 일정, 배정 현황 및 주문 데이터를 성공적으로 비웠습니다. (최종 완료 시 커밋 예정)")
    except Exception as del_err:
        db.rollback()
        raise RuntimeError(f"기존 일정 데이터 초기화 실패: {str(del_err)}")

    saved_count = 0
    order_map.clear()  # 기존 맵 초기화하여 신규 ID 생성 유도
        
    for row in reader:
        order_num = row.get(col_order_num, "").strip() if col_order_num else ""
        task_id = row.get(col_task_id, "").strip() if col_task_id else ""
        start_date_str = row.get(col_start_date, "").strip() if col_start_date else ""
        end_date_str = row.get(col_end_date, "").strip() if col_end_date else ""
        
        if not order_num or not task_id or not start_date_str or not end_date_str:
            continue
            
        cleaned_task = task_id.upper().strip()
        if cleaned_task in valid_tasks:
            task_id = cleaned_task
        elif task_id not in valid_tasks:
            print(f"⚠️ Direct Parser: Invalid task_id ({task_id}), skipping row.")
            continue
            
        # Resolve order_id
        num_key = order_num.lower().strip()
        if num_key in order_map:
            order_id = order_map[num_key]
        else:
            order_id = f"ord_new_{uuid.uuid4().hex[:8]}"
            order_map[num_key] = order_id
            
        product_name = row.get(col_product, "UNKNOWN").strip() if col_product else "UNKNOWN"
        order_count_val = row.get(col_count, "0").strip() if col_count else "0"
        m_cnt = re.search(r'\d+', order_count_val)
        order_count = int(m_cnt.group(0)) if m_cnt else 0
        due_date = row.get(col_due_date, "2026-07-31").strip() if col_due_date else "2026-07-31"
        order_status = row.get(col_status, "COMPLETED").strip() if col_status else "COMPLETED"
        
        if "완료" in order_status or "COMPLETED" in order_status.upper() or "납기내완료" in order_status:
            order_status = "COMPLETED"
        elif "진행" in order_status or "IN_PROGRESS" in order_status.upper():
            order_status = "IN_PROGRESS"
        else:
            order_status = "PENDING"
            
        try:
            with db.begin_nested():
                db.execute(
                    text("""
                        INSERT INTO orders (order_id, order_num, product_name, order_count, due_date, order_status)
                        VALUES (:order_id, :order_num, :product_name, :order_count, :due_date, :order_status)
                        ON CONFLICT (order_id) DO UPDATE SET
                            order_num = EXCLUDED.order_num,
                            product_name = EXCLUDED.product_name,
                            order_count = EXCLUDED.order_count,
                            due_date = EXCLUDED.due_date,
                            order_status = EXCLUDED.order_status
                    """),
                    {
                        "order_id": order_id,
                        "order_num": order_num,
                        "product_name": product_name,
                        "order_count": order_count,
                        "due_date": due_date,
                        "order_status": order_status
                    }
                )
        except Exception as e:
            print(f"❌ Direct Parser: Order insert error: {str(e)}")
            continue
            
        if len(start_date_str) == 10:
            start_date_str += " 09:00:00"
        if len(end_date_str) == 10:
            end_date_str += " 18:00:00"
            
        factory = row.get(col_factory, "A동").strip() if col_factory else "A동"
        if not factory:
            factory = "A동"
            
        # Parse workers
        workers_str = row.get(col_workers, "") if col_workers else ""
        workers = []
        if workers_str:
            emp_finds = re.findall(r'([eE][mM][pP]\d+)', workers_str)
            for emp_id in emp_finds:
                key = emp_id.lower().strip()
                if key in employee_map:
                    workers.append(employee_map[key])
            tokens = re.split(r'[^a-zA-Z0-9가-힣]+', workers_str)
            for token in tokens:
                key = token.lower().strip()
                if key in employee_map:
                    workers.append(employee_map[key])
            workers = list(set(workers))
            
        # Parse equipment
        equip_str = row.get(col_equip, "") if col_equip else ""
        equip_ids = []
        if equip_str:
            tokens = re.split(r'[;,/]+', equip_str)
            for token in tokens:
                token = token.strip()
                if not token:
                    continue
                eq_id = None
                key = token.lower()
                if key in equipment_map:
                    eq_id = equipment_map[key]
                else:
                    m = re.match(r'^장비\s*(\d+)$', token)
                    if m:
                        eq_num = int(m.group(1))
                        candidate_id = f"EQ{eq_num:03d}"
                        if candidate_id.lower() in equipment_map:
                            eq_id = equipment_map[candidate_id.lower()]
                    else:
                        m2 = re.match(r'^(?:[eE][qQ])?\s*(\d+)$', token)
                        if m2:
                            eq_num = int(m2.group(1))
                            candidate_id = f"EQ{eq_num:03d}"
                            if candidate_id.lower() in equipment_map:
                                eq_id = equipment_map[candidate_id.lower()]
                if eq_id:
                    equip_ids.append(eq_id)
            equip_ids = list(set(equip_ids))
            
        # Insert required equipments
        for eq_id in equip_ids:
            try:
                with db.begin_nested():
                    db.execute(
                        text("""
                            INSERT INTO required_equipments (task_id, eq_id)
                            VALUES (:task_id, :eq_id)
                            ON CONFLICT (task_id, eq_id) DO NOTHING
                        """),
                        {"task_id": task_id, "eq_id": eq_id}
                    )
            except Exception as e:
                print(f"❌ Direct Parser: Required equipment insert error: {str(e)}")
                
        # Insert/Update schedules
        existing = db.execute(
            text("SELECT id FROM schedules WHERE task_id = :task_id AND order_id = :order_id"),
            {"task_id": task_id, "order_id": order_id}
        ).mappings().first()
        
        if existing:
            schedule_id = existing["id"]
            try:
                with db.begin_nested():
                    db.execute(
                        text("""
                            UPDATE schedules 
                            SET start_date = :start_date, end_date = :end_date, factory = :factory
                            WHERE id = :id AND task_id = :task_id AND order_id = :order_id
                        """),
                        {
                            "id": schedule_id,
                            "task_id": task_id,
                            "order_id": order_id,
                            "start_date": start_date_str,
                            "end_date": end_date_str,
                            "factory": factory,
                        }
                    )
                    db.execute(
                        text("""
                            DELETE FROM schedule_assignments 
                            WHERE id = :id AND task_id = :task_id AND order_id = :order_id
                        """),
                        {
                            "id": schedule_id,
                            "task_id": task_id,
                            "order_id": order_id
                        }
                    )
            except Exception as e:
                print(f"❌ Direct Parser: Schedule update error: {str(e)}")
                continue
        else:
            schedule_id = f"sch_{uuid.uuid4().hex[:8]}"
            try:
                with db.begin_nested():
                    db.execute(
                        text("""
                            INSERT INTO schedules (id, task_id, order_id, start_date, end_date, factory)
                            VALUES (:id, :task_id, :order_id, :start_date, :end_date, :factory)
                        """),
                        {
                            "id": schedule_id,
                            "task_id": task_id,
                            "order_id": order_id,
                            "start_date": start_date_str,
                            "end_date": end_date_str,
                            "factory": factory,
                        }
                    )
            except Exception as e:
                print(f"❌ Direct Parser: Schedule insert error: {str(e)}")
                continue
                
        has_at_least_one_worker = False
        for worker_id in workers:
            try:
                with db.begin_nested():
                    db.execute(
                        text("""
                            INSERT INTO schedule_assignments (id, user_id, task_id, order_id)
                            VALUES (:id, :user_id, :task_id, :order_id)
                            ON CONFLICT (id, user_id, task_id, order_id) DO NOTHING
                        """),
                        {
                            "id": schedule_id,
                            "user_id": worker_id,
                            "task_id": task_id,
                            "order_id": order_id
                        }
                    )
                has_at_least_one_worker = True
            except Exception as e:
                print(f"❌ Direct Parser: Assignment insert error: {str(e)}")
                
        if has_at_least_one_worker:
            saved_count += 1
            
    db.commit()
    return saved_count
