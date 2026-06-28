from __future__ import annotations

import csv
import re
import uuid
from datetime import date, datetime
from io import StringIO

from sqlalchemy import text
from sqlalchemy.orm import Session


def _decode_csv(file_bytes: bytes) -> str:
    for enc in ("utf-8-sig", "utf-8", "cp949", "euc-kr"):
        try:
            return file_bytes.decode(enc)
        except UnicodeDecodeError:
            continue
    return file_bytes.decode("utf-8", errors="ignore")


def _normalize(text_value: str) -> str:
    value = (text_value or "").strip().lower()
    return re.sub(r"[^0-9a-z가-힣]", "", value)


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    raw = value.strip()
    if not raw:
        return None

    normalized = raw.replace(".", "-").replace("/", "-")
    for fmt in ("%Y-%m-%d", "%Y%m%d"):
        try:
            return datetime.strptime(normalized, fmt).date()
        except ValueError:
            continue
    return None


def _parse_int(value: str | None, default: int = 0) -> int:
    if value is None:
        return default
    m = re.search(r"-?\d+", str(value))
    if not m:
        return default
    return int(m.group(0))


def _read_rows(file_bytes: bytes) -> list[dict[str, str]]:
    content = _decode_csv(file_bytes)
    
    first_line = content.split('\n')[0] if content else ""
    delimiter = ','
    for d in ['\t', ';']:
        if d in first_line:
            delimiter = d
            break
            
    reader = csv.DictReader(StringIO(content), delimiter=delimiter)

    # 동기화 에러 발생해서 임시 방편으로 수정
    rows = []

    for row in reader:
        cleaned = {}

        for k, v in row.items():
            key = str(k or "").strip()

            if isinstance(v, list):
                value = ",".join(str(x) for x in v).strip()
            else:
                value = str(v or "").strip()

            cleaned[key] = value

        if any(cleaned.values()):
            rows.append(cleaned)
    return rows


def _match_key(row: dict[str, str], candidates: list[str]) -> str | None:
    if not row:
        return None
    normalized_map = {_normalize(k): k for k in row.keys()}
    for cand in candidates:
        matched = normalized_map.get(_normalize(cand))
        if matched:
            return matched

    candidate_norms = [_normalize(c) for c in candidates]
    for norm_key, original in normalized_map.items():
        if any(cand in norm_key or norm_key in cand for cand in candidate_norms):
            return original
    return None


def _truncate_tables(db: Session, table_names: list[str]) -> None:
    """테이블 전체 데이터 삭제. CASCADE는 외래키 제약을 무시하고 관련 데이터도 함께 삭제."""
    quoted = ", ".join(table_names)
    db.execute(text(f"TRUNCATE TABLE {quoted} CASCADE"))


def _sync_equipments(db: Session, rows: list[dict[str, str]]) -> dict:
    if not rows:
        _truncate_tables(db, ["equipments"])
        return {"table": "equipments", "rows": 0}

    first = rows[0]
    key_map = {
        "eq_id": _match_key(first, ["장비uuid", "eq_id", "장비id"]),
        "eq_name": _match_key(first, ["장비명", "eq_name"]),
        "eq_count": _match_key(first, ["장비전체수량", "장비수량", "eq_count"]),
        "available_eq_count": _match_key(
            first, ["가용장비수량", "사용가능수량", "available_eq_count"]
        ),
        "check_cycle": _match_key(first, ["점검주기", "check_cycle"]),
        "eq_status": _match_key(first, ["상태", "eq_status"]),
        "check_date": _match_key(first, ["다음점검일", "check_date"]),
        "recent_check_date": _match_key(first, ["최근점검일", "recent_check_date"]),
        "durability": _match_key(first, ["내구도", "durability"]),
        "rest_duration": _match_key(first, ["장비휴식시간", "장비 휴식 시간", "rest_duration", "rest_time"]),
    }

    required = ["eq_id", "eq_name"]
    missing = [field for field in required if not key_map[field]]
    if missing:
        raise ValueError(f"장비정보.csv 필수 헤더 매칭 실패: {', '.join(missing)}")

    payloads = []
    for row in rows:
        eq_id = row.get(key_map["eq_id"], "").strip()
        eq_name = row.get(key_map["eq_name"], "").strip()
        if not eq_id or not eq_name:
            continue

        # check_date 파싱 (NULL 방지)
        check_date_val = date.today()
        if key_map["check_date"]:
            parsed_check_date = _parse_date(row.get(key_map["check_date"]))
            if parsed_check_date:
                check_date_val = parsed_check_date

        # recent_check_date 파싱 (NULL 방지)
        recent_check_date_val = date.today()
        if key_map["recent_check_date"]:
            parsed_recent_check_date = _parse_date(row.get(key_map["recent_check_date"]))
            if parsed_recent_check_date:
                recent_check_date_val = parsed_recent_check_date

        payloads.append(
            {
                "eq_id": eq_id,
                "eq_name": eq_name,
                "eq_count": (
                    _parse_int(row.get(key_map["eq_count"]))
                    if key_map["eq_count"]
                    else 0
                ),
                "available_eq_count": (
                    _parse_int(row.get(key_map["available_eq_count"]))
                    if key_map["available_eq_count"]
                    else 0
                ),
                "check_cycle": (
                    _parse_int(row.get(key_map["check_cycle"]))
                    if key_map["check_cycle"]
                    else 0
                ),
                "eq_status": (
                    row.get(key_map["eq_status"], "정상").strip()
                    if key_map["eq_status"]
                    else "정상"
                ),
                "check_date": check_date_val,
                "recent_check_date": recent_check_date_val,
                "durability": (
                    _parse_int(row.get(key_map["durability"]))
                    if key_map["durability"]
                    else 0
                ),
                "rest_duration": (
                    _parse_int(row.get(key_map["rest_duration"]))
                    if key_map["rest_duration"]
                    else 0
                ),
            }
        )

    _truncate_tables(db, ["equipments"])
    if payloads:
        db.execute(
            text("""
                INSERT INTO equipments
                (eq_id, eq_name, eq_count, available_eq_count, check_cycle, eq_status, check_date, recent_check_date, durability, rest_duration)
                VALUES
                (:eq_id, :eq_name, :eq_count, :available_eq_count, :check_cycle, :eq_status, :check_date, :recent_check_date, :durability, :rest_duration)
                """),
            payloads,
        )

    return {"table": "equipments", "rows": len(payloads)}


def _ensure_task_factory_column(db: Session) -> None:
    db.execute(
        text("ALTER TABLE task ADD COLUMN IF NOT EXISTS task_factory VARCHAR(255) NULL")
    )


def _sync_tasks_and_required_equipments(
    db: Session, rows: list[dict[str, str]]
) -> dict:
    if not rows:
        _ensure_task_factory_column(db)
        _truncate_tables(db, ["required_equipments", "task"])
        return {
            "table": "task,required_equipments",
            "task_rows": 0,
            "required_rows": 0,
            "unknown_equipments": [],
        }

    first = rows[0]
    key_map = {
        "task_id": _match_key(first, ["작업uuid", "작업id", "task_id"]),
        "task_name": _match_key(first, ["작업명", "task_name"]),
        "task_type": _match_key(first, ["작업구분", "task_type"]),
        "task_level": _match_key(first, ["작업단계", "task_level"]),
        "task_time": _match_key(first, ["작업시간", "작업 시간", "task_time"]),
        "task_factory": _match_key(first, ["사용공장동", "task_factory", "공장동"]),
        "required_equipment": _match_key(
            first, ["필요장비", "required_equipment", "필요 장비"]
        ),
    }

    required = ["task_id", "task_name"]
    missing = [field for field in required if not key_map[field]]
    if missing:
        raise ValueError(
            f"테스트및공정목록.csv 필수 헤더 매칭 실패: {', '.join(missing)}"
        )

    _ensure_task_factory_column(db)

    task_payloads = []
    task_to_equipment_names: dict[str, list[str]] = {}

    for row in rows:
        task_id = row.get(key_map["task_id"], "").strip()
        task_name = row.get(key_map["task_name"], "").strip()
        if not task_id or not task_name:
            continue

        task_payloads.append(
            {
                "task_id": task_id,
                "task_level": (
                    row.get(key_map["task_level"], "1").strip()
                    if key_map["task_level"]
                    else "1"
                ),
                "task_name": task_name,
                "task_type": (
                    row.get(key_map["task_type"], "공정").strip()
                    if key_map["task_type"]
                    else "공정"
                ),
                "task_time": (
                    _parse_int(row.get(key_map["task_time"]), 0)
                    if key_map["task_time"]
                    else 0
                ),
                "task_factory": (
                    row.get(key_map["task_factory"], "").strip()
                    if key_map["task_factory"]
                    else ""
                ),
            }
        )

        if key_map["required_equipment"]:
            raw = row.get(key_map["required_equipment"], "")
            names = [n.strip() for n in re.split(r"[;,/]+", raw) if n.strip()]
            task_to_equipment_names[task_id] = names

    _truncate_tables(db, ["required_equipments", "task"])
    if task_payloads:
        db.execute(
            text("""
                INSERT INTO task
                (task_id, task_level, task_name, task_type, task_time, task_factory)
                VALUES
                (:task_id, :task_level, :task_name, :task_type, :task_time, :task_factory)
                """),
            task_payloads,
        )

    equipment_rows = (
        db.execute(text("SELECT eq_id, eq_name FROM equipments")).mappings().all()
    )
    eq_by_name = {
        str(row["eq_name"]).strip(): str(row["eq_id"]).strip() for row in equipment_rows
    }
    valid_eq_ids = {str(row["eq_id"]).strip() for row in equipment_rows}

    required_payloads = []
    unknown: list[str] = []
    for task_id, names in task_to_equipment_names.items():
        for name in names:
            eq_id = eq_by_name.get(name)
            if not eq_id and name in valid_eq_ids:
                eq_id = name
            if not eq_id:
                unknown.append(name)
                continue
            required_payloads.append({"task_id": task_id, "eq_id": eq_id})

    unique_payloads = {
        (item["task_id"], item["eq_id"]): item for item in required_payloads
    }
    required_payloads = list(unique_payloads.values())

    if required_payloads:
        db.execute(
            text("""
                INSERT INTO required_equipments (task_id, eq_id)
                VALUES (:task_id, :eq_id)
                """),
            required_payloads,
        )

    return {
        "table": "task,required_equipments",
        "task_rows": len(task_payloads),
        "required_rows": len(required_payloads),
        "unknown_equipments": sorted(set(unknown)),
    }



def _sync_safety_training(db: Session, rows: list[dict[str, str]]) -> dict:
    if not rows:
        _truncate_tables(db, ["safety_training"])
        return {"table": "safety_training", "rows": 0, "training_names": []}
    first = rows[0]
    emp_key = _match_key(first, ["사원ID", "emp_id", "사번"])
    if not emp_key:
        raise ValueError("직원교육이력.csv 필수 헤더 매칭 실패: 사원ID")

    header_keys = list(first.keys())
    training_pairs: list[tuple[str, str, str]] = []
    for key in header_keys:
        normalized = _normalize(key)
        if "이수일" in key:
            base = re.sub(r"\s*이수일\s*$", "", key).strip()
            expire_key = next(
                (
                    k
                    for k in header_keys
                    if _normalize(k) == _normalize(base + " 만료일")
                    or _normalize(k) == _normalize(base + "만료일")
                ),
                None,
            )
            if expire_key:
                training_pairs.append((base, key, expire_key))

    if not training_pairs:
        for key in header_keys:
            if re.search(r"교육\d+\s*이수일", key):
                base = re.sub(r"\s*이수일\s*$", "", key).strip()
                expire_guess = base + " 만료일"
                expire_key = next(
                    (
                        k
                        for k in header_keys
                        if _normalize(k) == _normalize(expire_guess)
                    ),
                    None,
                )
                if expire_key:
                    training_pairs.append((base, key, expire_key))

    # 추출한 교육명 리스트 저장
    training_names = [pair[0] for pair in training_pairs]

    payloads = []
    today = date.today()
    for row in rows:
        # 사원ID를 소문자로 정규화 (CSV에 EMP001이 있어도 DB의 emp001과 매칭하기 위함)
        emp_id = row.get(emp_key, "").strip().lower()
        if not emp_id:
            continue
        for training_name, issue_key, expire_key in training_pairs:
            training_date = _parse_date(row.get(issue_key))
            expired_date = _parse_date(row.get(expire_key))
            if not training_date or not expired_date:
                continue
            training_id = f"trn_{uuid.uuid5(uuid.NAMESPACE_DNS, f'{emp_id}:{training_name}').hex[:8]}"
            # 만료일 기준으로 훈련 상태 결정
            status = "유효" if expired_date >= today else "만료"
            payloads.append(
                {
                    "training_id": training_id,
                    "emp_id": emp_id,
                    "training_name": training_name,
                    "training_date": training_date,
                    "expired_date": expired_date,
                    "training_status": status,
                }
            )

    _truncate_tables(db, ["safety_training", "safety_training_metadata"])
    if payloads:
        db.execute(
            text("""
                INSERT INTO safety_training
                (training_id, emp_id, training_name, training_date, expired_date, training_status)
                VALUES
                (:training_id, :emp_id, :training_name, :training_date, :expired_date, :training_status)
                """),
            payloads,
        )


    # 교육명 목록을 metadata 테이블에 저장
    if training_names:
        import json
        metadata_id = f"meta_{uuid.uuid4().hex[:8]}"
        db.execute(
            text("""
                INSERT INTO safety_training_metadata (metadata_id, training_names, updated_at)
                VALUES (:metadata_id, :training_names, :updated_at)
                """),
            {
                "metadata_id": metadata_id,
                "training_names": json.dumps(training_names),
                "updated_at": today,
            },
        )
    
    db.commit()
    return {"table": "safety_training", "rows": len(payloads), "training_names": training_names}

def sync_schedule_input_csv(db: Session, file_name: str, file_bytes: bytes) -> dict:
    normalized_name = _normalize(file_name)
    rows = _read_rows(file_bytes)

    if "직원정보" in normalized_name:
        return {"action": "skip", "file": file_name, "reason": "DB 동기화 대상 아님"}

    if "장비정보" in normalized_name:
        result = _sync_equipments(db, rows)
        return {"action": "synced", "file": file_name, **result}

    if "테스트및공정목록" in normalized_name or "테스트및공정" in normalized_name:
        result = _sync_tasks_and_required_equipments(db, rows)
        return {"action": "synced", "file": file_name, **result}

    if "직원교육이력" in normalized_name:
        result = _sync_safety_training(db, rows)
        return {"action": "synced", "file": file_name, **result}

    return {"action": "skip", "file": file_name, "reason": "매핑되지 않은 CSV 파일"}
