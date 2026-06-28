"""
holiday_calendar.py
────────────────────
공휴일 관리 모듈.

· 한국 법정 공휴일: `holidays` 라이브러리 자동 로드 (연도별 캐싱)
· 회사 자체 휴일: DB `company_holidays` 테이블 (없으면 무시)
· is_holiday / is_workday_kr / next_workday_kr 세 가지 공개 함수 제공
"""
from __future__ import annotations

from datetime import date, timedelta
from functools import lru_cache
from typing import Optional, Set

import holidays as holidays_lib
from sqlalchemy.orm import Session
from sqlalchemy import text

try:
    from app.logger import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)


# ─── 법정 공휴일 캐시 ─────────────────────────────────────────────────────────
@lru_cache(maxsize=16)
def _get_kr_holidays(year: int) -> Set[date]:
    """해당 연도의 한국 법정 공휴일 집합 반환 (LRU 캐시)."""
    return set(holidays_lib.KR(years=year).keys())


def _is_kr_public_holiday(d: date) -> bool:
    return d in _get_kr_holidays(d.year)


# ─── 공개 함수 ────────────────────────────────────────────────────────────────
def is_holiday(d: date, db: Optional[Session] = None) -> bool:
    """
    주어진 날짜가 공휴일인지 확인합니다.

    · 한국 법정 공휴일 여부를 확인합니다.
    · db 세션이 주어지면 `company_holidays` 테이블도 조회합니다.
    """
    if _is_kr_public_holiday(d):
        return True

    if db is not None:
        try:
            with db.begin_nested():
                row = db.execute(
                    text("SELECT 1 FROM company_holidays WHERE holiday_date = :d"),
                    {"d": d},
                ).fetchone()
                if row:
                    return True
        except Exception:
            # 테이블이 없으면 무시
            pass

    return False


def is_workday_kr(
    d: date,
    work_days_set: Set[int],
    db: Optional[Session] = None,
) -> bool:
    """
    주어진 날짜가 실제 근무일인지 확인합니다.

    · work_days_set: 근무 요일 집합 (0=월 … 6=일)
    · 공휴일이면 근무일에서 제외합니다.
    """
    return d.weekday() in work_days_set and not is_holiday(d, db)


def next_workday_kr(
    d: date,
    work_days_set: Set[int],
    db: Optional[Session] = None,
) -> date:
    """
    주어진 날짜 다음 날부터 탐색하여 첫 번째 근무일을 반환합니다.
    (주말 + 공휴일 + 회사 자체 휴일 모두 스킵)
    """
    curr = d + timedelta(days=1)
    while not is_workday_kr(curr, work_days_set, db):
        curr += timedelta(days=1)
    return curr


def count_workdays_between(
    start: date,
    end: date,
    work_days_set: Set[int],
    db: Optional[Session] = None,
) -> int:
    """
    start(포함) ~ end(포함) 사이의 실제 근무일 수를 반환합니다.
    """
    count = 0
    curr = start
    while curr <= end:
        if is_workday_kr(curr, work_days_set, db):
            count += 1
        curr += timedelta(days=1)
    return count
