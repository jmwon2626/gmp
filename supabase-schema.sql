-- ══════════════════════════════════════════════════════════════════════
-- SaMD GMP 통합 관리 시스템 (QMS-PMS) 데이터베이스 스키마 및 초기 데이터
-- ══════════════════════════════════════════════════════════════════════

-- 1. Storage 버킷 생성 (이미 존재하면 무시)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('gmp_files', 'gmp_files', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage 보안 정책 (중복 생성 오류 해결을 위해 DROP 후 CREATE)
-- [읽기 정책]
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'gmp_files');

-- [쓰기 정책]
DROP POLICY IF EXISTS "Public Insert" ON storage.objects;
CREATE POLICY "Public Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'gmp_files');

-- [삭제 정책]
DROP POLICY IF EXISTS "Public Delete" ON storage.objects;
CREATE POLICY "Public Delete" ON storage.objects FOR DELETE USING (bucket_id = 'gmp_files');


-- 3. 핵심 테이블 생성 (IF NOT EXISTS로 안정성 확보)
-- [문서 관리 테이블]
CREATE TABLE IF NOT EXISTS public.gmp_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT DEFAULT '미착수' CHECK (status IN ('미착수','작성중','부분완료','초안완료','검토중','수정필요','승인대기','승인완료','외부진행중','보류','지연','완료')),
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Critical','High','Medium','Low')),
  assigned_groups TEXT[] DEFAULT '{}',
  assignee TEXT,
  due_date DATE,
  description TEXT,
  file_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- [이슈 및 리스크 관리 테이블]
CREATE TABLE IF NOT EXISTS public.gmp_issues (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  severity TEXT DEFAULT 'Medium' CHECK (severity IN ('Critical','High','Medium','Low')),
  status TEXT DEFAULT 'Open' CHECK (status IN ('Open','In Progress','Waiting','Decision Needed','Resolved','Closed')),
  doc_id TEXT REFERENCES public.gmp_documents(id) ON DELETE SET NULL,
  assigned_groups TEXT[] DEFAULT '{}',
  due_date DATE,
  description TEXT,
  decisions_needed TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [부서 간 협조 요청 테이블]
CREATE TABLE IF NOT EXISTS public.gmp_cooperations (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  req_group TEXT NOT NULL,
  res_group TEXT NOT NULL,
  requester TEXT,
  status TEXT DEFAULT '요청' CHECK (status IN ('요청','확인중','답변완료','반려','보류','완료')),
  due_date DATE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- 4. 실시간 동기화(Realtime) 활성화
-- 이미 존재하는 경우 무시하도록 DO 블록 사용
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'gmp_documents') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gmp_documents;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'gmp_issues') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gmp_issues;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'gmp_cooperations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gmp_cooperations;
  END IF;
END $$;


-- 5. 필수 문서 시드 데이터 (Seed Data)
INSERT INTO public.gmp_documents (id, title, category, status, progress, priority, assigned_groups, due_date) VALUES
-- 사용자 매뉴얼
('DOC-001', 'bluemit_manual', '사용자 매뉴얼', '완료', 100, 'Low', ARRAY['BlueMit', 'UX/UI'], NULL),
('DOC-002', 'DTX의료진_manual', '사용자 매뉴얼', '부분완료', 70, 'High', ARRAY['BlueMit', 'F/E', 'Product'], '2025-05-16'),
('DOC-003', 'DTX콘텐츠관리_manual', '사용자 매뉴얼', '미착수', 0, 'High', ARRAY['BlueMit', 'B/E', 'DB', 'Product'], '2025-05-19'),
-- 자산/품질/문서관리
('DOC-004', '자산관리대장', '자산관리', '완료', 100, 'Low', ARRAY['Common', 'Infra'], NULL),
('DOC-005', '조직도', '품질매뉴얼', '일부작성', 30, 'Critical', ARRAY['Executive', 'Common'], '2025-05-09'),
('DOC-006', '품질매뉴얼', '품질매뉴얼', '수정필요', 60, 'Medium', ARRAY['QA', 'Executive'], '2025-05-20'),
('DOC-007', '문서관리 절차서', '문서관리', '일부작성', 40, 'Medium', ARRAY['QA', 'RA'], '2025-05-20'),
('DOC-008', '품질문서 관리대장', '문서관리', '일부작성', 40, 'Medium', ARRAY['QA'], NULL),
-- 시험/제조/표준서/보안
('DOC-009', '완제품시험절차서', '시험 관련 문서', '완료', 100, 'Low', ARRAY['BlueMit', 'QA'], NULL),
('DOC-010', '완제품시험성적서', '시험 관련 문서', '외부진행중', 80, 'Medium', ARRAY['External Lab', 'Meditrix', 'QA'], '2025-05-09'),
('DOC-011', 'BlueMit_DTx_시험규격/성능/모양', '시험 관련 문서', '완료', 100, 'Low', ARRAY['BlueMit', 'QA', 'RA'], NULL),
('DOC-012', '제조공정도', '제조 관련 문서', '수정필요', 60, 'Low', ARRAY['Common', 'DevOps'], '2025-05-22'),
('DOC-013', '공급/위탁업체 목록', '제조 관련 문서', '완료', 100, 'Low', ARRAY['Common', 'PMO'], NULL),
('DOC-014', '제품표준서(DMR)', '제품표준서', '일부작성', 20, 'Critical', ARRAY['QA', 'RA', 'Product', 'BlueMit', 'Meditrix'], '2025-05-13'),
('DOC-015', '전자적 침해행위 보안 절차서', '보안 절차서', '보완필요', 50, 'Medium', ARRAY['Security', 'Infra', 'QA'], '2025-05-23'),
-- IEC 62304 표준 템플릿
('T-MAP', 'IEC 62304-ISO 13485 Mapping Table', 'IEC 62304', '미착수', 0, 'High', ARRAY['PMO', 'QA'], '2025-05-12'),
('T-01', 'Software Description', 'IEC 62304', '미착수', 0, 'Medium', ARRAY['Product', 'BlueMit'], '2025-05-29'),
('T-02', 'Software Requirement Specification (SRS)', 'IEC 62304', '작성중', 40, 'High', ARRAY['Product', 'F/E', 'Mobile', 'B/E', 'QA'], '2025-05-14'),
('T-03', 'Architecture Design Chart (ADC)', 'IEC 62304', '미착수', 0, 'High', ARRAY['B/E', 'DB', 'Infra', 'Security'], '2025-05-29'),
('T-04', 'Software Design Specification (SDS)', 'IEC 62304', '미착수', 0, 'Medium', ARRAY['F/E', 'Mobile', 'B/E', 'DB'], '2025-05-29'),
('T-05', 'Software Design Coding Standard', 'IEC 62304', '미착수', 0, 'Medium', ARRAY['F/E', 'B/E'], '2025-05-29'),
('T-06', 'Risk Management Plan (RMP)', 'IEC 62304', '미착수', 0, 'High', ARRAY['QA', 'RA', 'Clinical'], '2025-05-29'),
('T-07', 'Risk Management Report (RMR)', 'IEC 62304', '미착수', 0, 'High', ARRAY['QA', 'RA'], '2025-05-29'),
('T-08', 'FMEA Table', 'IEC 62304', '미착수', 0, 'High', ARRAY['QA', 'Clinical', 'Product'], '2025-05-29'),
('T-09', 'Cyber Security Checklist', 'IEC 62304', '미착수', 0, 'High', ARRAY['Security', 'Infra', 'B/E', 'QA'], '2025-05-29'),
('T-10', 'Cyber Security Report', 'IEC 62304', '미착수', 0, 'Medium', ARRAY['Security'], '2025-05-29'),
('T-11', 'Unit Test Plan & Report', 'IEC 62304', '미착수', 0, 'Medium', ARRAY['F/E', 'Mobile', 'B/E', 'QA'], '2025-05-29'),
('T-12', 'Integration Test Plan & Report', 'IEC 62304', '미착수', 0, 'Medium', ARRAY['F/E', 'B/E', 'QA'], '2025-05-29'),
('T-13', 'System Test Plan & Report', 'IEC 62304', '미착수', 0, 'Medium', ARRAY['QA', 'BlueMit'], '2025-05-29'),
('T-14', 'Software Release Note', 'IEC 62304', '미착수', 0, 'Low', ARRAY['DevOps', 'QA'], '2025-05-29'),
('T-15', 'List of Release (Version History)', 'IEC 62304', '미착수', 0, 'Low', ARRAY['DevOps'], '2025-05-29'),
('T-16', 'Configuration Identification Note', 'IEC 62304', '미착수', 0, 'Low', ARRAY['DevOps', 'B/E'], '2025-05-29'),
('T-17', 'Traceability Diagram, Note', 'IEC 62304', '미착수', 0, 'High', ARRAY['QA', 'Product', 'B/E'], '2025-05-29'),
('T-18', 'Problem and Modification Analysis', 'IEC 62304', '미착수', 0, 'Medium', ARRAY['QA'], '2025-05-29'),
('T-19', 'Document and Evaluate Feedback', 'IEC 62304', '미착수', 0, 'Medium', ARRAY['QA', 'Clinical'], '2025-05-29'),
('T-20', 'Change Management Record', 'IEC 62304', '미착수', 0, 'Medium', ARRAY['QA', 'PMO'], '2025-05-29'),
('T-21', 'Re-release Modification Software Note', 'IEC 62304', '미착수', 0, 'Low', ARRAY['DevOps'], '2025-05-29'),
('T-22', 'Bug List', 'IEC 62304', '미착수', 0, 'Medium', ARRAY['QA', 'F/E', 'B/E'], '2025-05-29'),
('T-23', 'Analyse Problem for Trends', 'IEC 62304', '미착수', 0, 'Low', ARRAY['QA', 'Data'], '2025-05-29'),
('T-24-1', '의료기기 이상사례 보고서', 'IEC 62304', '미착수', 0, 'Low', ARRAY['RA', 'Clinical'], '2025-05-29'),
('T-24-2', '의료기기 안내문 통지 보고서', 'IEC 62304', '미착수', 0, 'Low', ARRAY['RA'], '2025-05-29'),
('T-26', 'Use Specification', 'IEC 62304', '미착수', 0, 'Medium', ARRAY['UX/UI', 'Product'], '2025-05-29'),
('T-27', 'Use Scenario', 'IEC 62304', '미착수', 0, 'Medium', ARRAY['UX/UI', 'Clinical'], '2025-05-29'),
('T-28', 'User Interface Specification', 'IEC 62304', '미착수', 0, 'Medium', ARRAY['UX/UI', 'F/E', 'Mobile'], '2025-05-29')
ON CONFLICT (id) DO NOTHING;


-- 6. 핵심 이슈 및 리스크 시드 데이터
INSERT INTO public.gmp_issues (id, title, severity, status, doc_id, assigned_groups, due_date, description, decisions_needed) VALUES
('ISSUE-001', 'GMP 인증 요건 조직 미확정 (품질책임자 지정)', 'Critical', 'Open', 'DOC-005', ARRAY['Executive'], '2025-05-09', '조직도 내 품질책임자, 기술책임자 등 부재로 문서 승인 체계가 무효화될 위기', '조직 확정 및 승인자 매핑, 외부 컨설턴트 영입 결정'),
('ISSUE-002', '제품표준서 초안 5/13 납기 임박', 'High', 'Open', 'DOC-014', ARRAY['BlueMit', 'Meditrix', 'QA'], '2025-05-13', '사용자 매뉴얼 미완료에 따른 제품표준서 작성 병목', '미완료 파트 TBD 처리 후 제출할지 여부 결정'),
('ISSUE-003', '표준 템플릿 29종 5/29 초안 완료 목표', 'High', 'Open', NULL, ARRAY['PMO', 'QA'], '2025-05-29', '29종 중 28종 미착수. 물리적 시간 부족 및 추적성 단절 우려', '우선순위 기반 작성 순서 확정 및 외부 컨설팅 도입 검토'),
('ISSUE-004', 'T-25 템플릿 번호 누락 확인 필요', 'Medium', 'Open', NULL, ARRAY['QA', 'PMO'], '2025-05-10', '목록 상 T-24-2 이후 T-26으로 건너뜜. 식약처/인증기관 심사 시 누락 사유 소명 필요', 'T-25 존재 여부 확인 및 리스트 갱신'),
('ISSUE-005', '완료 문서의 공식 검토·승인 이력 미확인', 'High', 'Open', NULL, ARRAY['QA', 'RA'], '2025-05-15', '보고서 상 완료된 문서들이 실제 QMS 승인 절차를 거쳤는지 미지수', '각 문서 서명 여부 전수 조사'),
('RISK-01', '[리스크] 문서 간 불일치 및 Traceability 단절', 'High', 'Open', 'T-17', ARRAY['QA', 'Product'], '2025-05-29', '요구사항-설계-시험 간 추적성 단절 시 GMP 부적합 판정', 'Mapping Table 선작성 및 SRS 완료 직후 T-17 착수'),
('RISK-02', '[리스크] 외부 시험성적서 수령 지연', 'Medium', 'Open', 'DOC-010', ARRAY['Meditrix'], '2025-05-09', '성적서 수령 지연 시 신청 문서 패키지 구성 불가', '외부 기관 진행 현황 즉시 팔로업')
ON CONFLICT (id) DO NOTHING;


-- 7. 협조 요청 시드 데이터
INSERT INTO public.gmp_cooperations (title, req_group, res_group, status, due_date, description) VALUES
('제품표준서 작성을 위한 기구축 자료 공유 요청', 'Meditrix', 'BlueMit', '요청', '2025-05-09', 'DMR 구성을 위해 현재까지 픽스된 HW/SW 사양서 일체 공유 바랍니다.'),
('사이버보안 체크리스트 작성을 위한 인프라 구성도 요청', 'QA', 'Infra', '확인중', '2025-05-10', 'T-09 작성을 위해 AWS 아키텍처 및 보안 그룹 설정 내역이 필요합니다.')
ON CONFLICT (id) DO NOTHING;