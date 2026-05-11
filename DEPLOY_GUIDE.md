# 🚀 SaMD GMP PMS — 운영 배포 가이드

> **중요**: 이 가이드는 운영 중인 서비스(데이터 보존 필수)를 위한 절차입니다.
> 개발 서버처럼 프로젝트를 삭제하고 재생성하지 마세요.

---

## 📋 이번 업데이트 내용 요약

| 변경 항목 | 설명 |
|---|---|
| 문서 구분 필드 추가 | 신청문서 / 심사문서 선택 가능 (기본정보 탭) |
| 문서 목록 컬럼 추가 | ID와 문서명 사이에 문서 구분 열 추가 |
| 전체 컬럼 정렬 버튼 | 모든 헤더 클릭 시 오름차순/내림차순 정렬 (▲/▼) |
| 문서 구분 필터 추가 | 신청문서/심사문서 별도 필터링 드롭다운 |
| 버그 수정 | colSpan 오류, 필터 초기화 누락 등 |

---

## 🗄️ Step 1 — Supabase DB 마이그레이션 (반드시 먼저 실행)

> ⚠️ **코드 배포 전에 DB 변경을 먼저 해야 합니다.**

### 1-1. Supabase Dashboard 접속
```
https://supabase.com/dashboard/project/{YOUR_PROJECT_ID}/sql/new
```

### 1-2. migration-add-doc-type.sql 실행
`migration-add-doc-type.sql` 파일 전체 내용을 SQL Editor에 붙여넣고 **[Run]** 클릭

### 1-3. 결과 확인
```
column_name | data_type
doc_type    | text
```
위 결과가 나오면 성공. 기존 데이터는 변경되지 않습니다.

---

## 💻 Step 2 — 로컬 빌드 확인

```bash
cd gmp-pms
npm install
npm run build   # 오류 없이 dist/ 폴더 생성되면 OK
```

---

## 🌐 Step 3 — Vercel 배포

### 방법 A: GitHub 자동 배포 (권장)
```bash
git add src/App.jsx migration-add-doc-type.sql DEPLOY_GUIDE.md
git commit -m "feat: 문서 구분 필드·정렬 기능 추가, 버그 수정 v1.1.0"
git push origin main
```
→ Vercel이 자동 감지하여 배포 시작

### 방법 B: Vercel CLI
```bash
npm i -g vercel
vercel --prod
```

### 방법 C: Vercel Dashboard 수동
Vercel → 프로젝트 → Deployments → **Redeploy**

---

## ✅ Step 4 — 배포 후 검증 체크리스트

https://bluemitgmp.vercel.app/ 에서 확인:

- [ ] 문서 관리 목록에 **"문서 구분"** 컬럼이 보이는가
- [ ] 컬럼 헤더 클릭 시 **▲/▼ 정렬** 동작하는가
- [ ] 문서 클릭 → 기본정보 탭에 **"문서 구분"** 드롭다운이 있는가
- [ ] 신청문서/심사문서 선택 후 저장 정상 동작하는가
- [ ] 상단 필터에 **"전체 문서구분"** 필터가 있는가
- [ ] 기존 파일 첨부 및 문서 내용이 그대로 유지되는가
- [ ] 좌측 하단 **"Supabase 연결됨"** (초록 점) 표시되는가

---

## 🔧 환경 변수 확인

Vercel → Project → **Settings → Environment Variables**

| 변수명 | 예시 |
|---|---|
| `VITE_SUPABASE_URL` | `https://xxxxxxxxxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` |

---

## 🚨 롤백 절차

### 코드 롤백
```bash
git revert HEAD && git push origin main
# 또는 Vercel Dashboard → Deployments → 이전 배포 → Promote to Production
```

### DB 롤백 (doc_type 제거)
```sql
-- 기존 doc_type 데이터가 삭제되므로 신중히 실행
ALTER TABLE public.documents DROP COLUMN IF EXISTS doc_type;
```

---

## 🐛 수정된 버그 & 알려진 리스크

### 수정 완료

| # | 문제 | 수정 |
|---|---|---|
| 1 | 문서 목록 빈 행 ColSpan 오류 | 11 → 12 수정 |
| 2 | 필터 초기화 시 문서구분 필터 미포함 | 초기화 시 docType 포함 |
| 3 | 기본 정렬 없음 | ID 기준 오름차순 기본 정렬 |

### 향후 개선 권장사항

| # | 리스크 | 권장 대응 |
|---|---|---|
| 1 | 이슈/액션/리스크 삭제 시 ID 재번호 부여 | 삭제 후 갭(gap) 허용 방식 전환 권장 (히스토리 참조 일관성 유지) |
| 2 | RLS 전체 허용 (인증 없이 누구나 수정 가능) | Supabase Auth 도입 후 RLS 강화 |
| 3 | gmp-files 버킷 public 설정 | 민감 문서 private 버킷 + signed URL 전환 |
| 4 | 시드 데이터 자동 upsert 조건 | DB 비어있을 때만 실행 조건 강화 |

---

## 📁 변경된 파일

```
gmp-pms/
├── src/App.jsx                    ← 핵심 변경
├── migration-add-doc-type.sql     ← DB 마이그레이션 (신규)
└── DEPLOY_GUIDE.md                ← 이 파일
```

---

## 🔄 향후 배포 표준 절차

```
1. DB 스키마 변경 있음?
   └─ YES → Supabase SQL Editor에서 마이그레이션 먼저 실행
   └─ NO  → Step 2로

2. 코드 수정 → npm run dev 로 로컬 검증

3. npm run build 빌드 오류 없음 확인

4. git commit + push → Vercel 자동 배포

5. 운영 URL 기능 검증

6. 이상 없으면 완료 / 이상 있으면 Vercel Rollback
```

---
*v1.1.0 | 2026-05-11*
