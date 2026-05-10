-- ══════════════════════════════════════════════════════════════════════
--  SaMD GMP 인증 문서관리 PMS · Supabase 스키마
--  Supabase Dashboard → SQL Editor 에 붙여넣고 [Run] 클릭
--  ※ 이 파일 실행 후 seed-data.sql을 실행하세요.
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- 1) 문서
CREATE TABLE IF NOT EXISTS public.documents (
  id TEXT PRIMARY KEY, doc_name TEXT NOT NULL, doc_number TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT '기타', sub_category TEXT DEFAULT '',
  related_standard TEXT DEFAULT '', description TEXT DEFAULT '', purpose TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT '미착수'
    CHECK (status IN ('미착수','작성중','부분완료','초안완료','검토중','수정필요','승인대기','승인완료','외부진행중','보류','지연','완료')),
  progress INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Critical','High','Medium','Low')),
  owner_org TEXT DEFAULT '', owner_group TEXT DEFAULT '',
  primary_owner TEXT DEFAULT '', co_authors TEXT DEFAULT '',
  reviewer TEXT DEFAULT '', approver TEXT DEFAULT '',
  due_date DATE, completed_date DATE,
  definition_of_done TEXT DEFAULT '', dependency_docs TEXT DEFAULT '',
  successor_docs TEXT DEFAULT '', notes TEXT DEFAULT '',
  remaining_tasks TEXT DEFAULT '', preconditions TEXT DEFAULT '',
  file_count INT DEFAULT 0, issue_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_doc ON public.documents;
CREATE TRIGGER trg_doc BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) 문서-업무군 매핑
CREATE TABLE IF NOT EXISTS public.document_work_groups (
  id BIGSERIAL PRIMARY KEY, document_id TEXT NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  work_group TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dwg_doc ON public.document_work_groups(document_id);
CREATE INDEX IF NOT EXISTS idx_dwg_wg ON public.document_work_groups(work_group);

-- 3) 이슈
CREATE TABLE IF NOT EXISTS public.issues (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '',
  document_id TEXT REFERENCES public.documents(id) ON DELETE SET NULL,
  severity TEXT NOT NULL DEFAULT 'Medium' CHECK (severity IN ('Critical','High','Medium','Low')),
  status TEXT NOT NULL DEFAULT 'Open'
    CHECK (status IN ('Open','In Progress','Waiting','Decision Needed','Resolved','Closed')),
  assignee TEXT DEFAULT '', assigned_group TEXT DEFAULT '',
  due_date DATE, created_date DATE DEFAULT CURRENT_DATE, resolved_date DATE,
  decision_needed BOOLEAN DEFAULT FALSE, decisions TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_iss ON public.issues;
CREATE TRIGGER trg_iss BEFORE UPDATE ON public.issues FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) 리스크
CREATE TABLE IF NOT EXISTS public.risks (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '',
  level TEXT NOT NULL DEFAULT 'Medium' CHECK (level IN ('Critical','High','Medium','Low')),
  mitigation TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Mitigated','Accepted','Closed')),
  related_issue TEXT DEFAULT '', owner TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_risk ON public.risks;
CREATE TRIGGER trg_risk BEFORE UPDATE ON public.risks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) 액션 아이템
CREATE TABLE IF NOT EXISTS public.action_items (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, assignee TEXT DEFAULT '',
  due_date DATE, priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Critical','High','Medium','Low')),
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','In Progress','Done','Overdue','Cancelled')),
  definition_of_done TEXT DEFAULT '', document_id TEXT REFERENCES public.documents(id) ON DELETE SET NULL,
  notes TEXT DEFAULT '', completed_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_ai ON public.action_items;
CREATE TRIGGER trg_ai BEFORE UPDATE ON public.action_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) 마일스톤
CREATE TABLE IF NOT EXISTS public.milestones (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '',
  target_date DATE, status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Done','Active','Pending','Overdue')),
  linked_docs TEXT DEFAULT '', linked_issues TEXT DEFAULT '',
  completion_rate INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_ms ON public.milestones;
CREATE TRIGGER trg_ms BEFORE UPDATE ON public.milestones FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7) 협조 요청
CREATE TABLE IF NOT EXISTS public.cooperation_requests (
  id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, content TEXT DEFAULT '',
  requester TEXT NOT NULL DEFAULT '', requester_group TEXT DEFAULT '',
  receiver_group TEXT NOT NULL DEFAULT '',
  document_id TEXT REFERENCES public.documents(id) ON DELETE SET NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT '요청' CHECK (status IN ('요청','확인중','답변완료','반려','보류','완료')),
  response TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_coop ON public.cooperation_requests;
CREATE TRIGGER trg_coop BEFORE UPDATE ON public.cooperation_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8) 파일 첨부
CREATE TABLE IF NOT EXISTS public.file_attachments (
  id BIGSERIAL PRIMARY KEY, document_id TEXT REFERENCES public.documents(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL, file_path TEXT NOT NULL, file_size BIGINT DEFAULT 0,
  file_type TEXT DEFAULT '', version TEXT DEFAULT 'v1.0',
  uploader TEXT DEFAULT '', description TEXT DEFAULT '',
  is_latest BOOLEAN DEFAULT TRUE, public_url TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9) 코멘트
CREATE TABLE IF NOT EXISTS public.comments (
  id BIGSERIAL PRIMARY KEY, document_id TEXT REFERENCES public.documents(id) ON DELETE SET NULL,
  issue_id TEXT REFERENCES public.issues(id) ON DELETE SET NULL,
  parent_id BIGINT REFERENCES public.comments(id) ON DELETE CASCADE,
  author TEXT NOT NULL DEFAULT '', author_group TEXT DEFAULT '',
  content TEXT NOT NULL, is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10) 감사 로그
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGSERIAL PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  action TEXT NOT NULL, field_name TEXT DEFAULT '',
  old_value TEXT DEFAULT '', new_value TEXT DEFAULT '',
  actor TEXT DEFAULT 'System', created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit ON public.audit_logs(entity_type, entity_id);

-- 11) 체크리스트
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id BIGSERIAL PRIMARY KEY, document_id TEXT NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  item_text TEXT NOT NULL, is_checked BOOLEAN DEFAULT FALSE,
  checked_by TEXT DEFAULT '', checked_at TIMESTAMPTZ, sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: 팀 내부 도구 — 모두 허용
DO $$ DECLARE t TEXT;
BEGIN FOR t IN SELECT unnest(ARRAY['documents','document_work_groups','issues','risks','action_items','milestones','cooperation_requests','file_attachments','comments','audit_logs','checklist_items']) LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('DROP POLICY IF EXISTS "r_%s" ON public.%I', t, t);
  EXECUTE format('DROP POLICY IF EXISTS "w_%s" ON public.%I', t, t);
  EXECUTE format('CREATE POLICY "r_%s" ON public.%I FOR SELECT USING (true)', t, t);
  EXECUTE format('CREATE POLICY "w_%s" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t, t);
END LOOP; END $$;

-- Realtime
DO $$ DECLARE t TEXT;
BEGIN FOR t IN SELECT unnest(ARRAY['documents','issues','risks','action_items','milestones','cooperation_requests','comments','file_attachments','audit_logs','checklist_items']) LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename=t) THEN
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
  END IF;
END LOOP; END $$;

-- Storage 버킷
INSERT INTO storage.buckets (id, name, public) VALUES ('gmp-files','gmp-files',true) ON CONFLICT (id) DO NOTHING;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='gmp_r') THEN
    CREATE POLICY "gmp_r" ON storage.objects FOR SELECT USING (bucket_id='gmp-files');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='gmp_i') THEN
    CREATE POLICY "gmp_i" ON storage.objects FOR INSERT WITH CHECK (bucket_id='gmp-files');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='gmp_d') THEN
    CREATE POLICY "gmp_d" ON storage.objects FOR DELETE USING (bucket_id='gmp-files');
  END IF;
END $$;

-- 완료! 이제 seed-data.sql을 실행하세요.
