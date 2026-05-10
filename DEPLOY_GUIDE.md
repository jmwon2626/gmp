# SaMD GMP 인증 문서관리 PMS

> BlueMit DTx 제품의 독립형소프트웨어(SaMD) GMP 인증 취득을 위한  
> 문서 작성 현황 관리 시스템 (Project Management System)

## 기술 스택

| 항목 | 기술 |
|------|------|
| 프론트엔드 | React 18 + Vite |
| 백엔드/DB | Supabase (PostgreSQL + Realtime + Storage) |
| 배포 | Vercel |
| 인증 | 없음 (팀 내부 도구용 — anon key 사용) |

---

## 배포 가이드 (10분 내 완료)

### 1단계: Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com) 에서 프로젝트 생성
2. **Settings > API** 에서 다음 정보를 복사:
   - `Project URL` (예: `https://xxxx.supabase.co`)
   - `anon public key`

### 2단계: SQL 실행

Supabase Dashboard → **SQL Editor** 에서:

1. **`supabase-schema.sql`** 내용을 붙여넣고 **Run** 클릭
2. **`seed-data.sql`** 내용을 붙여넣고 **Run** 클릭

> 순서를 반드시 지켜주세요. schema → seed 순입니다.

### 2.5단계: Storage 확인 (파일 첨부 기능)

schema SQL 실행 시 `gmp-files` 스토리지 버킷이 자동 생성됩니다.

1. Supabase Dashboard → **Storage** 메뉴에서 `gmp-files` 버킷이 있는지 확인
2. 만약 없다면 수동으로 **New bucket** → 이름: `gmp-files` → **Public bucket** 체크 → 생성
3. 버킷 클릭 → **Policies** 탭 → 아래 정책이 있는지 확인:
   - `SELECT`: 모든 사용자 허용
   - `INSERT`: 모든 사용자 허용
   - `DELETE`: 모든 사용자 허용

> 💡 파일 업로드 최대 크기는 Supabase 기본 설정 50MB입니다.  
> 필요 시 Supabase Dashboard → Settings → Storage 에서 변경 가능합니다.

### 3단계: Vercel 배포

1. 이 프로젝트를 GitHub 리포지토리에 push
2. [vercel.com](https://vercel.com) 에서 **Import** → 해당 리포지토리 선택
3. **Environment Variables** 설정:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. **Deploy** 클릭

### 또는 로컬 실행

```bash
npm install
cp .env.example .env
# .env 파일에 Supabase URL과 anon key 입력
npm run dev
```

---

## 주요 기능

### 📊 대시보드
- 전체 42종 문서 진행률 한눈에 파악
- 카테고리별 / 업무군별 진행률
- Critical 이슈, 마감 임박 문서, 지연 문서 실시간 표시
- 승인자 미지정 / 담당자 미지정 현황

### 📄 문서 관리
- 42종 GMP 문서 목록 관리
- 카테고리 / 상태 / 업무군 / 우선순위 필터링
- 문서 상세 편집 (기본정보, 작성현황, 파일첨부, 업무군, 이슈, 메모)
- 문서별 담당 업무군 복수 지정 (F/E, B/E, QA 등)

### 📎 파일 첨부 (Supabase Storage 연동)
- 문서별 드래그&드롭 / 클릭 파일 업로드
- PDF, DOCX, HWP, XLSX, PPTX, 이미지, ZIP 등 모든 파일 형식 지원
- 파일 버전 관리 (같은 이름 파일 업로드 시 이전 버전 자동 보존)
- 파일별 설명, 업로더, 업로드일, 크기, 최신 여부 표시
- 다른 팀원이 바로 다운로드 가능
- 문서 목록에서 📎 아이콘으로 첨부파일 유무 확인
- 대시보드에서 파일 미첨부 문서 수 표시
- Realtime 구독으로 파일 추가/삭제 시 다른 사용자에게 즉시 반영

### ⚠️ 이슈 관리
- 5건 초기 이슈 (ISSUE-001~005)
- 심각도 / 상태 / 의사결정 필요 여부 관리

### 🛡️ 리스크 관리
- 6건 리스크 (R-01~R-06)
- 등급별 시각화, 대응 방안 표시

### 🎯 Action Items
- 12건 액션 아이템 (A-01~A-12)
- 상태 즉시 변경 가능

### 👥 업무군별 보드
- F/E, Mobile, B/E, DB, Infra, QA, RA 등 19개 업무군
- 업무군 카드 클릭 시 해당 문서만 필터링

### 📅 마일스톤
- M-01~M-07 마일스톤 타임라인
- 완료율 프로그레스 바

### 🤝 협조 요청
- 그룹 간 협조 요청 생성/관리
- 요청 상태 추적

---

## 문서 카테고리 (15종)

사용자 매뉴얼 | 자산관리 | 품질매뉴얼 | 문서관리 | 시험 관련 문서 | 제조 관련 문서 | 제품표준서 | 보안 절차서 | IEC 62304 표준 템플릿 | 신청 문서 | 리스크/위험관리 문서 | 형상관리 문서 | 검증/시험 문서 | 사후관리/Post-market 문서 | 법규/이상사례 보고 문서

## 업무군 (19개)

F/E | Mobile | B/E | DB | Infra | DevOps | Security | QA | RA | PMO | Product | UX/UI | Clinical | Data | External Lab | Meditrix | BlueMit | Executive | Common

## 문서 상태값 (12종)

미착수 → 작성중 → 부분완료 → 초안완료 → 검토중 → 수정필요 → 승인대기 → 승인완료 / 완료  
+ 외부진행중 / 보류 / 지연

---

## Supabase Storage (파일 첨부)

`gmp-files` 버킷이 자동 생성됩니다.  
향후 파일 업로드 기능 확장 시 사용합니다.

## Supabase Realtime

documents, issues, action_items 테이블에 Realtime이 활성화되어  
여러 팀원이 동시 접속해도 변경사항이 실시간 반영됩니다.

---

## 데이터베이스 스키마

| 테이블 | 설명 |
|--------|------|
| `documents` | GMP 문서 42종 관리 |
| `document_work_groups` | 문서-업무군 다대다 매핑 |
| `issues` | 이슈 관리 |
| `risks` | 리스크 관리 |
| `action_items` | 액션 아이템 |
| `milestones` | 마일스톤 |
| `cooperation_requests` | 협조 요청 |
| `file_attachments` | 파일 첨부 메타데이터 |
| `comments` | 코멘트/Q&A |
| `audit_logs` | 감사 로그 |
| `checklist_items` | 문서별 체크리스트 |

---

## 참고 문서

- SaMD_GMP_진행현황보고서.html (v1.0, 2025.05.06)
- ISO 13485 / IEC 62304 / ISO 14971
- 디지털의료기기 GMP 가이드라인
- 디지털의료기기 전자적 침해행위 보안지침

---

*문서번호: QMS-RPT-2025-001 | BlueMit DTx SaMD GMP 인증 프로젝트*
