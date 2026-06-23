-- DB 상태 진단 쿼리 (safety_manage 폴더 동기화 디버깅용)

-- 쿼리1: NeoChip PDF가 DB에 저장되었는지 확인
SELECT file_id, file_name, file_path, file_size, embedding_status 
FROM documents 
WHERE file_name = 'NeoChip Semiconductor 안전관리규정_통합.pdf';

-- 쿼리2: safety_manage 폴더의 모든 동기화된 파일 목록
SELECT file_id, file_name, file_path, file_size 
FROM documents 
WHERE file_path LIKE '%safety_manage%' 
ORDER BY file_name;

-- 쿼리3: 전체 문서 메타데이터 수
SELECT COUNT(*) as total_documents FROM documents;

-- 쿼리4: 임베딩 상태별 통계 (completed/pending/failed)
SELECT embedding_status, COUNT(*) 
FROM documents 
GROUP BY embedding_status;
