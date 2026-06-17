-- PostgreSQL DML Script to insert mock data for testing

-- Clear existing data (in case CASCADE drop wasn't run)
TRUNCATE TABLE schedule_assignments CASCADE;
TRUNCATE TABLE documents CASCADE;
TRUNCATE TABLE safety_training CASCADE;
TRUNCATE TABLE required_equipments CASCADE;
TRUNCATE TABLE equipments CASCADE;
TRUNCATE TABLE schedules CASCADE;
TRUNCATE TABLE task CASCADE;
TRUNCATE TABLE orders CASCADE;
TRUNCATE TABLE employees CASCADE;

-- 1. Insert employees
INSERT INTO employees (emp_id, login_id, login_pw, emp_name, emp_role, emp_date) VALUES
('emp_001', 'admin_kim', '$2b$12$eImiTXuWVxjM722m4.GbuOTzB5q.pQ1pZtFodS5e/XpW8b4Xy2sGu', '김부장', 'leader', '2020-03-01'),
('emp_002', 'member_lee', '$2b$12$eImiTXuWVxjM722m4.GbuOTzB5q.pQ1pZtFodS5e/XpW8b4Xy2sGu', '이대리', 'member', '2023-07-15'),
('emp_003', 'member_park', '$2b$12$eImiTXuWVxjM722m4.GbuOTzB5q.pQ1pZtFodS5e/XpW8b4Xy2sGu', '박사원', 'member', '2025-01-10');

-- 2. Insert orders
INSERT INTO orders (order_id, order_num, product_name, order_count, due_date, order_status) VALUES
('ord_001', 'ORD-202606-001', '단팥빵 (50g)', 5000, '2026-06-25', 'PROCESSING'),
('ord_002', 'ORD-202606-002', '글루텐프리 쌀식빵', 1200, '2026-06-28', 'PENDING'),
('ord_003', 'ORD-202606-003', '초코 소라빵', 3000, '2026-06-22', 'COMPLETED');

-- 3. Insert tasks
INSERT INTO task (task_id, task_level, task_name, task_type, task_time) VALUES
('tsk_001', '중', '원료 배합 및 반죽믹싱', 'Mixing', 60),
('tsk_002', '상', '반죽 분할 및 발효', 'Fermentation', 120),
('tsk_003', '상', '오븐 베이킹', 'Baking', 45),
('tsk_004', '하', '제품 냉각 및 자동 포장', 'Packaging', 30);

-- 4. Insert schedules
INSERT INTO schedules (id, task_id, order_id, start_date, end_date, factory) VALUES
('sch_001', 'tsk_001', 'ord_001', '2026-06-18 09:00:00', '2026-06-18 10:00:00', '제1공장 A라인'),
('sch_002', 'tsk_002', 'ord_001', '2026-06-18 10:00:00', '2026-06-18 12:00:00', '제1공장 A라인'),
('sch_003', 'tsk_003', 'ord_001', '2026-06-18 13:00:00', '2026-06-18 13:45:00', '제1공장 B라인'),
('sch_004', 'tsk_001', 'ord_002', '2026-06-19 09:00:00', '2026-06-19 10:00:00', '제2공장 C라인');

-- 5. Insert schedule_assignments (Untitled table)
INSERT INTO schedule_assignments (id, user_id, task_id, order_id) VALUES
('sch_001', 'emp_002', 'tsk_001', 'ord_001'),
('sch_001', 'emp_003', 'tsk_001', 'ord_001'),
('sch_002', 'emp_002', 'tsk_002', 'ord_001'),
('sch_003', 'emp_003', 'tsk_003', 'ord_001'),
('sch_004', 'emp_002', 'tsk_001', 'ord_002');

-- 6. Insert safety_training records
INSERT INTO safety_training (training_id, emp_id, training_name, training_date, expired_date, training_status) VALUES
('trn_001', 'emp_001', '정기 안전 보건 교육 (관리감독자)', '2026-01-15', '2027-01-15', 'COMPLETED'),
('trn_002', 'emp_002', '식품 위생 및 기계 조작 안전 교육', '2026-03-10', '2027-03-10', 'COMPLETED'),
('trn_003', 'emp_003', '화재 예방 및 비상 대피 훈련', '2026-05-20', '2027-05-20', 'COMPLETED');

-- 7. Insert equipments
INSERT INTO equipments (eq_id, eq_name, eq_count, available_eq_count, check_cycle, eq_status, check_date, recent_check_date) VALUES
('eq_001', '산업용 대형 믹서기 M-101', 5, 5, 30, '정상', '2026-06-15', '2026-06-15'),
('eq_002', '항온항습 제빵 발효실 R-201', 2, 2, 60, '정상', '2026-05-10', '2026-05-10'),
('eq_003', '터널식 가스 오븐 O-301', 3, 2, 90, '점검 필요', '2026-03-20', '2026-06-17'),
('eq_004', '고속 자동 씰링 포장기 P-401', 4, 4, 30, '정상', '2026-06-12', '2026-06-12');

-- 8. Insert required_equipments
INSERT INTO required_equipments (task_id, eq_id) VALUES
('tsk_001', 'eq_001'),
('tsk_002', 'eq_002'),
('tsk_003', 'eq_003'),
('tsk_004', 'eq_004');

-- 9. Insert documents
INSERT INTO documents (file_id, uploader, file_name, file_size, file_extension, file_path, is_template, file_created_at, file_updated_at, embedding_date, embedding_status) VALUES
('doc_001', 'emp_001', 'HACCP 위생 가이드라인 v2.pdf', 2453120, 'pdf', '/uploads/documents/haccp_guide_v2.pdf', false, '2026-06-17 10:00:00', '2026-06-17 10:00:00', '2026-06-17 10:05:00', 'COMPLETED'),
('doc_002', 'emp_002', '대형믹서기 작동 표준 절차서(SOP).docx', 562180, 'docx', '/uploads/documents/mixer_sop.docx', true, '2026-06-17 11:30:00', '2026-06-17 11:30:00', '2026-06-17 11:32:00', 'COMPLETED');
