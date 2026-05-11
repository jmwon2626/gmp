-- ══════════════════════════════════════════════════════════════════════
--  [안전 마이그레이션] doc_type 컬럼 추가
--  ✅ 데이터 손실 없음 / 기존 레코드 영향 없음
--  Supabase Dashboard → SQL Editor 에 붙여넣고 [Run] 클릭
-- ══════════════════════════════════════════════════════════════════════

-- 1) doc_type 컬럼 추가 (이미 있으면 무시)
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS doc_type TEXT DEFAULT ''
    CHECK (doc_type IN ('', '신청문서', '심사문서'));

-- 2) 실행 결과 확인 (아래 SELECT 결과에서 doc_type 컬럼이 보이면 성공)
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'documents'
  AND column_name  = 'doc_type';

-- ══════════════════════════════════════════════════════════════════════
--  (선택) 기존 문서에 일괄 초기값 설정하고 싶을 때만 실행
--  예: 특정 카테고리 문서를 '신청문서'로 지정
-- ══════════════════════════════════════════════════════════════════════
-- UPDATE public.documents
-- SET doc_type = '신청문서'
-- WHERE category IN ('신청 문서')
--   AND (doc_type IS NULL OR doc_type = '');

-- ══════════════════════════════════════════════════════════════════════
-- 완료! 이후 Vercel 배포를 진행하세요.
-- ══════════════════════════════════════════════════════════════════════
