import pandas as pd
from datetime import date
from sqlalchemy.orm import Session
from app.services.schedule_pipeline.csv_io import load_input_csvs_from_r2, upload_schedule_to_r2
from app.services.schedule_pipeline.gpt_scheduler import get_qualified_workers, get_daily_work_minutes, get_work_days_from_rag
from app.services.schedule_pipeline.conflict_resolver import resolve_conflicts

def generate_and_upload_schedule(db: Session) -> dict:
    """
    Orchestrates the entire schedule generation pipeline:
    1. Downloads input CSVs from R2
    2. Runs RAG + GPT safety/qualification mapping
    3. Runs conflict resolution to calculate dates and resource allocations
    4. Computes schedule summary
    5. Uploads results back to R2
    """
    print("🚀 Starting schedule generation pipeline...")
    
    # Step 1: Load input CSVs from R2
    print("📥 Loading input CSVs from R2...")
    orders_df, equip_df, training_df, tasks_df = load_input_csvs_from_r2()
    
    # Step 2: Query safety guidelines and match workers using GPT
    print("🧠 Fetching safety rules and matching workers via GPT...")
    qualified_workers = get_qualified_workers(db, training_df)
    print(f"✅ Qualified workers map generated: {list(qualified_workers.keys())}")
    
    # Fetch daily work minutes from RAG
    print("🕰️ Querying daily working hours from RAG...")
    daily_work_minutes = get_daily_work_minutes(db)
    print(f"✅ Daily working hours limit: {daily_work_minutes} minutes ({daily_work_minutes/60:.1f} hours)")
    
    # Fetch working days from RAG
    print("📅 Querying weekly working days from RAG...")
    work_days = get_work_days_from_rag(db)
    print(f"✅ Active working weekdays: {work_days}")
    
    # Step 3: Run conflict resolution date calculations
    print("⚡ Resolving resource conflicts and scheduling dates...")
    today = date.today()
    schedule_df = resolve_conflicts(
        db, orders_df, equip_df, tasks_df, qualified_workers,
        daily_work_minutes=daily_work_minutes,
        start_date=today,
        work_days=work_days
    )
    
    if schedule_df.empty:
        raise ValueError("Generated schedule is empty. Please check the inputs.")
        
    # Step 4: Compute summary DataFrame
    print("📊 Generating schedule summary...")
    summary_rows = []
    grouped = schedule_df.groupby("주문번호")
    for order_num, group in grouped:
        prod_name = group["제품명"].iloc[0]
        qty = group["수량"].iloc[0]
        due_date = group["납기일"].iloc[0]
        
        # Sort and get min/max dates
        start_dates = pd.to_datetime(group["시작일"])
        end_dates = pd.to_datetime(group["종료일"])
        
        start_min = start_dates.min().strftime("%Y-%m-%d")
        end_max = end_dates.max().strftime("%Y-%m-%d")
        
        total_tasks = len(group)
        total_mins = group["작업시간_분"].sum()
        
        # Check if completed within due date
        due_dt = pd.to_datetime(due_date)
        status = "납기내완료" if end_dates.max() <= due_dt else "납기초과"
        
        summary_rows.append({
            "주문번호": order_num,
            "제품명": prod_name,
            "수량": qty,
            "납기일": due_date,
            "생산시작일": start_min,
            "생산종료일": end_max,
            "총작업수": total_tasks,
            "총작업시간_분": total_mins,
            "납기상태": status
        })
        
    summary_df = pd.DataFrame(summary_rows)
    # Sort summary by order number
    summary_df = summary_df.sort_values(by="주문번호").reset_index(drop=True)
    
    # Step 5: Upload output files to R2
    print("📤 Uploading results to R2...")
    upload_schedule_to_r2(schedule_df, "생산일정결과.csv")
    upload_schedule_to_r2(summary_df, "생산일정요약.csv")
    
    print("🎉 Schedule generation pipeline complete!")
    return {
        "total_schedules": len(schedule_df),
        "total_orders": len(summary_df)
    }
