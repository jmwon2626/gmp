import{useState,useEffect,useCallback,useMemo,useRef}from"react";
import{supabase}from"./supabaseClient.js";

/* ══════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════ */
const CATEGORIES=['사용자 매뉴얼','자산관리','품질매뉴얼','문서관리','시험 관련 문서','제조 관련 문서','제품표준서','보안 절차서','IEC 62304 표준 템플릿','신청 문서','리스크/위험관리 문서','형상관리 문서','검증/시험 문서','사후관리/Post-market 문서','법규/이상사례 보고 문서'];
const WORK_GROUPS=['F/E','Mobile','B/E','DB','Infra','DevOps','Security','QA','RA','PMO','Product','UX/UI','Clinical','Data','External Lab','Meditrix','BlueMit','Executive','Common'];
const DOC_STATUSES=['미착수','작성중','부분완료','초안완료','검토중','수정필요','승인대기','승인완료','외부진행중','보류','지연','완료'];
const PRIORITIES=['Critical','High','Medium','Low'];
const ISSUE_STATUSES=['Open','In Progress','Waiting','Decision Needed','Resolved','Closed'];
const COOP_STATUSES=['요청','확인중','답변완료','반려','보류','완료'];
const ACTION_STATUSES=['Open','In Progress','Done','Overdue','Cancelled'];
const MS_STATUSES=['Done','Active','Pending','Overdue'];

const statusColor=(s)=>{const m={'완료':'#0DBF7E','승인완료':'#0DBF7E','작성중':'#3B8BFF','부분완료':'#F5A623','초안완료':'#00C2D4','검토중':'#E86A1A','수정필요':'#E86A1A','승인대기':'#7C3AED','외부진행중':'#3B8BFF','보류':'#8A9BB5','지연':'#E83030','미착수':'#4A5B73',
Open:'#E83030','In Progress':'#3B8BFF',Waiting:'#F5A623','Decision Needed':'#E86A1A',Resolved:'#0DBF7E',Closed:'#8A9BB5',
Done:'#0DBF7E',Active:'#3B8BFF',Pending:'#8A9BB5',Overdue:'#E83030',
'요청':'#3B8BFF','확인중':'#F5A623','답변완료':'#0DBF7E','반려':'#E83030','Critical':'#E83030','High':'#E86A1A','Medium':'#F5A623','Low':'#8A9BB5'};return m[s]||'#4A5B73';};
const priorityIcon=(p)=>({Critical:'🔴',High:'🟠',Medium:'🟡',Low:'⚪'}[p]||'');

/* ── ID 유틸리티 함수 ── */
// ID에서 숫자 부분 추출 (DOC-01→1, ISSUE-003→3, R-01→1, A-12→12, M-01→1)
const idNum=(id)=>{const m=(id||'').match(/(\d+)$/);return m?parseInt(m[1],10):0;};
// ID 기준 오름차순 정렬
const sortById=(arr)=>[...arr].sort((a,b)=>idNum(a.id)-idNum(b.id));
// 다음 ID 생성 (기존 최대값 + 1)
const nextId=(items,prefix,pad)=>{const max=items.reduce((mx,i)=>Math.max(mx,idNum(i.id)),0);return`${prefix}${String(max+1).padStart(pad,'0')}`;};
// 삭제 후 ID 재번호 부여
const renumberIds=(items,prefix,pad)=>sortById(items).map((item,i)=>({...item,id:`${prefix}${String(i+1).padStart(pad,'0')}`}));

/* ══════════════════════════════════════════════════
   SEED DATA (오프라인/초기 시드)
   ══════════════════════════════════════════════════ */
const SEED_DOCS=[
{id:'DOC-UM-001',doc_name:'bluemit_manual',category:'사용자 매뉴얼',status:'완료',progress:100,priority:'Medium',owner_org:'BlueMit',owner_group:'Product',primary_owner:'BlueMit',due_date:null,notes:'작성 완료',remaining_tasks:'최종 검토·승인 이력 확인 필요',work_groups:['Product','BlueMit']},
{id:'DOC-UM-002',doc_name:'DTX의료진_manual',category:'사용자 매뉴얼',status:'부분완료',progress:55,priority:'High',owner_org:'BlueMit',owner_group:'Product',primary_owner:'BlueMit',due_date:'2025-05-16',notes:'의료진 파트 완료',remaining_tasks:'메디트릭스 관리자 파트 작성 필요',work_groups:['Product','BlueMit','UX/UI']},
{id:'DOC-UM-003',doc_name:'DTX콘텐츠관리_manual',category:'사용자 매뉴얼',status:'미착수',progress:0,priority:'High',owner_org:'BlueMit',owner_group:'Product',primary_owner:'BlueMit',due_date:'2025-05-19',notes:'신규 작성 필요',remaining_tasks:'콘텐츠 등록·수정·삭제·버전관리 절차',work_groups:['F/E','B/E','DB','Product','QA']},
{id:'DOC-AM-001',doc_name:'자산관리대장',category:'자산관리',status:'완료',progress:100,priority:'Low',owner_org:'공통',owner_group:'Common',primary_owner:'공통',due_date:null,notes:'작성 완료',remaining_tasks:'갱신 주기 확인',work_groups:['Common','Infra']},
{id:'DOC-QM-001',doc_name:'조직도',category:'품질매뉴얼',status:'부분완료',progress:25,priority:'Critical',owner_org:'공통',owner_group:'Common',primary_owner:'공통',due_date:'2025-05-09',notes:'GMP 필수 직책 미확정',remaining_tasks:'품질책임자 등 확정',work_groups:['Common','Executive','QA']},
{id:'DOC-QM-002',doc_name:'품질매뉴얼',category:'품질매뉴얼',status:'수정필요',progress:40,priority:'High',owner_org:'공통',owner_group:'QA',primary_owner:'공통',due_date:'2025-05-20',notes:'ISO 13485 보완 필요',remaining_tasks:'적용 범위, 조직도 반영',work_groups:['QA','RA','Executive']},
{id:'DOC-DM-001',doc_name:'문서관리 절차서',category:'문서관리',status:'부분완료',progress:30,priority:'Medium',owner_org:'공통',owner_group:'QA',primary_owner:'공통',due_date:'2025-05-20',notes:'문서번호 체계 수립 중',remaining_tasks:'문서번호·개정번호·보존기간 매핑',work_groups:['QA','PMO']},
{id:'DOC-DM-002',doc_name:'품질문서 관리대장',category:'문서관리',status:'부분완료',progress:25,priority:'Medium',owner_org:'공통',owner_group:'QA',primary_owner:'공통',due_date:'2025-05-20',notes:'통합 관리대장 형식 전환 필요',remaining_tasks:'문서명·번호·버전 통합 관리',work_groups:['QA','PMO']},
{id:'DOC-TS-001',doc_name:'완제품시험절차서',category:'시험 관련 문서',status:'완료',progress:100,priority:'Medium',owner_org:'BlueMit',owner_group:'QA',primary_owner:'BlueMit',due_date:null,notes:'작성 완료',remaining_tasks:'',work_groups:['QA','BlueMit']},
{id:'DOC-TS-002',doc_name:'완제품시험성적서',category:'시험 관련 문서',status:'외부진행중',progress:50,priority:'High',owner_org:'메디트릭스',owner_group:'External Lab',primary_owner:'메디트릭스',due_date:null,notes:'외부 기관 의뢰 중',remaining_tasks:'결과 수령 일정 확인',work_groups:['External Lab','Meditrix','QA']},
{id:'DOC-TS-003',doc_name:'시험규격/성능기술서/모양 및 구조 특성',category:'시험 관련 문서',status:'완료',progress:100,priority:'Medium',owner_org:'BlueMit',owner_group:'Product',primary_owner:'BlueMit',due_date:null,notes:'작성 완료, 메디트릭스 전달 완료',remaining_tasks:'',work_groups:['BlueMit','Product']},
{id:'DOC-MF-001',doc_name:'제조공정도',category:'제조 관련 문서',status:'수정필요',progress:60,priority:'Medium',owner_org:'공통',owner_group:'Common',primary_owner:'공통',due_date:'2025-05-22',notes:'SW 빌드·배포 공정 포함 필요',remaining_tasks:'수정 사항 도출',work_groups:['Common','DevOps','Infra']},
{id:'DOC-MF-002',doc_name:'공급업체 및 위탁업체 목록',category:'제조 관련 문서',status:'완료',progress:100,priority:'Low',owner_org:'공통',owner_group:'Common',primary_owner:'공통',due_date:null,notes:'작성 완료',remaining_tasks:'평가 주기 확인',work_groups:['Common','PMO']},
{id:'DOC-PS-001',doc_name:'제품표준서 (Device Master Record)',category:'제품표준서',status:'부분완료',progress:15,priority:'Critical',owner_org:'공통',owner_group:'QA',primary_owner:'공통',due_date:'2025-05-13',notes:'5/13 초안 전달 목표',remaining_tasks:'매뉴얼 반영, 제품사양 점검',work_groups:['QA','RA','Product','BlueMit','Meditrix']},
{id:'DOC-SC-001',doc_name:'전자적 침해행위 보안 절차서',category:'보안 절차서',status:'수정필요',progress:20,priority:'Medium',owner_org:'공통',owner_group:'Security',primary_owner:'공통',due_date:'2025-05-23',notes:'보안 절차 보강 필요',remaining_tasks:'사이버보안 Gap 분석',work_groups:['Security','Infra','B/E','QA']},
{id:'DOC-T-MAP',doc_name:'IEC 62304–ISO 13485 Mapping Table',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'High',owner_org:'공통',owner_group:'QA',primary_owner:'공통',due_date:'2025-05-12',notes:'QMS 문서 체계 골격',remaining_tasks:'전 조항 매핑',work_groups:['QA','RA','PMO']},
{id:'DOC-T-02',doc_name:'T-02: SRS',category:'IEC 62304 표준 템플릿',status:'작성중',progress:35,priority:'High',owner_org:'공통',owner_group:'Product',primary_owner:'기술팀',due_date:'2025-05-14',notes:'유일하게 작성 진행 중',remaining_tasks:'요구사항 완전성 검토',work_groups:['Product','F/E','Mobile','B/E','QA']},
{id:'DOC-T-01',doc_name:'T-01: Software Description',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Medium',owner_org:'공통',owner_group:'Product',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'제품 개요 기술',work_groups:['Product','Clinical']},
{id:'DOC-T-03',doc_name:'T-03: Architecture Design Chart',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Medium',owner_org:'공통',owner_group:'B/E',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'아키텍처 다이어그램',work_groups:['B/E','DB','Infra','Security']},
{id:'DOC-T-04',doc_name:'T-04: SDS',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Medium',owner_org:'공통',owner_group:'F/E',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'모듈별 상세 설계',work_groups:['F/E','Mobile','B/E','DB']},
{id:'DOC-T-05',doc_name:'T-05: Coding Standard',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Medium',owner_org:'공통',owner_group:'F/E',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'코딩 표준 정의',work_groups:['F/E','Mobile','B/E']},
{id:'DOC-T-06',doc_name:'T-06: Risk Management Plan',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'High',owner_org:'공통',owner_group:'QA',primary_owner:'공통',due_date:'2025-05-29',notes:'ISO 14971',remaining_tasks:'FMEA 선행 필요',work_groups:['QA','RA','Clinical']},
{id:'DOC-T-07',doc_name:'T-07: Risk Management Report',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Medium',owner_org:'공통',owner_group:'QA',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'',work_groups:['QA','RA']},
{id:'DOC-T-08',doc_name:'T-08: FMEA Table',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'High',owner_org:'공통',owner_group:'QA',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'고장 모드 분석',work_groups:['QA','Clinical','Product']},
{id:'DOC-T-09',doc_name:'T-09: Cyber Security Checklist',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Medium',owner_org:'공통',owner_group:'Security',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'',work_groups:['Security','Infra','B/E','QA']},
{id:'DOC-T-10',doc_name:'T-10: Cyber Security Report',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Medium',owner_org:'공통',owner_group:'Security',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'',work_groups:['Security','Infra','QA']},
{id:'DOC-T-11',doc_name:'T-11: Unit Test Plan & Report',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Medium',owner_org:'공통',owner_group:'QA',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'',work_groups:['F/E','Mobile','B/E','QA']},
{id:'DOC-T-12',doc_name:'T-12: Integration Test Plan & Report',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Medium',owner_org:'공통',owner_group:'QA',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'',work_groups:['F/E','B/E','QA']},
{id:'DOC-T-13',doc_name:'T-13: System Test Plan & Report',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Medium',owner_org:'공통',owner_group:'QA',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'',work_groups:['QA','Product']},
{id:'DOC-T-14',doc_name:'T-14: Software Release Note',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Low',owner_org:'공통',owner_group:'DevOps',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'',work_groups:['DevOps','QA']},
{id:'DOC-T-15',doc_name:'T-15: List of Release',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Low',owner_org:'공통',owner_group:'DevOps',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'',work_groups:['DevOps','PMO']},
{id:'DOC-T-16',doc_name:'T-16: Configuration Identification Note',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Low',owner_org:'공통',owner_group:'DevOps',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'',work_groups:['DevOps','QA']},
{id:'DOC-T-17',doc_name:'T-17: Traceability Diagram',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'High',owner_org:'공통',owner_group:'QA',primary_owner:'공통',due_date:'2025-05-29',notes:'SRS 완료 후 작성',remaining_tasks:'추적성 매트릭스',work_groups:['QA','Product','F/E','B/E']},
{id:'DOC-T-18',doc_name:'T-18: Problem and Modification Analysis',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Low',owner_org:'공통',owner_group:'QA',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'',work_groups:['QA','Product']},
{id:'DOC-T-19',doc_name:'T-19: Document and Evaluate Feedback',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Low',owner_org:'공통',owner_group:'QA',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'',work_groups:['QA','Clinical']},
{id:'DOC-T-20',doc_name:'T-20: Change Management Record',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Low',owner_org:'공통',owner_group:'QA',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'',work_groups:['QA','PMO']},
{id:'DOC-T-21',doc_name:'T-21: Re-release Modification Note',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Low',owner_org:'공통',owner_group:'DevOps',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'',work_groups:['DevOps','QA']},
{id:'DOC-T-22',doc_name:'T-22: Bug List',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Low',owner_org:'공통',owner_group:'QA',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'',work_groups:['QA','F/E','B/E']},
{id:'DOC-T-23',doc_name:'T-23: Analyse Problem for Trends',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Low',owner_org:'공통',owner_group:'QA',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'',work_groups:['QA','Data']},
{id:'DOC-T-24-1',doc_name:'T-24-1: 의료기기 이상사례 보고서',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Medium',owner_org:'공통',owner_group:'RA',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'',work_groups:['RA','Clinical']},
{id:'DOC-T-24-2',doc_name:'T-24-2: 의료기기 안내문 통지 보고서',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Medium',owner_org:'공통',owner_group:'RA',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'',work_groups:['RA','Clinical']},
{id:'DOC-T-26',doc_name:'T-26: Use Specification',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Medium',owner_org:'공통',owner_group:'UX/UI',primary_owner:'공통',due_date:'2025-05-29',notes:'IEC 62366',remaining_tasks:'',work_groups:['UX/UI','Product','Clinical']},
{id:'DOC-T-27',doc_name:'T-27: Use Scenario',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Medium',owner_org:'공통',owner_group:'UX/UI',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'',work_groups:['UX/UI','Product','Clinical']},
{id:'DOC-T-28',doc_name:'T-28: User Interface Specification',category:'IEC 62304 표준 템플릿',status:'미착수',progress:0,priority:'Medium',owner_org:'공통',owner_group:'UX/UI',primary_owner:'공통',due_date:'2025-05-29',notes:'',remaining_tasks:'',work_groups:['UX/UI','F/E','Product']},
];

const SEED_ISSUES=[
{id:'ISSUE-001',title:'GMP 인증 요건 조직 미확정',severity:'Critical',status:'Open',due_date:null,decision_needed:true,description:'품질책임자·기술책임자 등 미지정. 전체 문서 승인 체계 공백.'},
{id:'ISSUE-002',title:'제품표준서 초안 5/13 납기 임박',severity:'High',status:'Open',due_date:'2025-05-13',decision_needed:true,description:'미완료 메뉴얼 반영 범위 결정 필요.'},
{id:'ISSUE-003',title:'표준 템플릿 29종 5/29 초안 완료 목표',severity:'High',status:'Open',due_date:'2025-05-29',decision_needed:true,description:'잔여 28종 + Mapping Table 23일 내 초안화 필요.'},
{id:'ISSUE-004',title:'T-25 템플릿 번호 누락 확인 필요',severity:'Medium',status:'Open',due_date:null,decision_needed:false,description:'T-24-2 다음 T-26으로 넘어감.'},
{id:'ISSUE-005',title:'완료 문서 공식 검토·승인 이력 미확인',severity:'High',status:'Open',due_date:null,decision_needed:false,description:'GMP 심사 기준 최종 승인 여부 구분 필요.'},
];

const SEED_RISKS=[
{id:'R-01',title:'조직 미확정에 따른 문서 체계 무효화',level:'Critical',mitigation:'최소 품질책임자 1인 5/9까지 지정',status:'Open'},
{id:'R-02',title:'제품표준서 5/13 납기 미달',level:'Critical',mitigation:'완료 메뉴얼 기반 선작성, 미완료 TBD 처리',status:'Open'},
{id:'R-03',title:'29종 템플릿 5/29 미완성',level:'High',mitigation:'우선순위 매트릭스 수립, 외부 컨설팅 검토',status:'Open'},
{id:'R-04',title:'문서 간 불일치 및 Traceability 단절',level:'High',mitigation:'Mapping Table 선작성',status:'Open'},
{id:'R-05',title:'외부 시험성적서 수령 지연',level:'Medium',mitigation:'수령 예정일 즉시 확인 요청',status:'Open'},
{id:'R-06',title:'사이버보안 절차서 요건 미충족',level:'Medium',mitigation:'Gap 분석, T-09/T-10 연계 보완',status:'Open'},
];

const SEED_ACTIONS=[
{id:'A-01',title:'GMP 필수 직책 확정 및 조직도 완성',assignee:'경영진',due_date:'2025-05-09',priority:'Critical',status:'Open'},
{id:'A-02',title:'제품표준서 가용 파트 초안 작성',assignee:'BlueMit+메디트릭스',due_date:'2025-05-13',priority:'Critical',status:'Open'},
{id:'A-03',title:'DTX의료진_manual 관리자 파트 완성',assignee:'BlueMit',due_date:'2025-05-16',priority:'High',status:'Open'},
{id:'A-04',title:'DTX콘텐츠관리_manual 신규 작성',assignee:'BlueMit',due_date:'2025-05-19',priority:'High',status:'Open'},
{id:'A-05',title:'Mapping Table 작성',assignee:'PM',due_date:'2025-05-12',priority:'High',status:'Open'},
{id:'A-06',title:'템플릿 29종 우선순위 및 담당 배분',assignee:'PM',due_date:'2025-05-09',priority:'High',status:'Open'},
{id:'A-07',title:'SRS 조기 완료 및 Traceability 착수',assignee:'기술팀',due_date:'2025-05-14',priority:'High',status:'Open'},
{id:'A-08',title:'문서관리 절차서 전체 문서 매핑',assignee:'QA',due_date:'2025-05-20',priority:'Medium',status:'Open'},
{id:'A-09',title:'품질매뉴얼 수정 완료',assignee:'QA+경영진',due_date:'2025-05-20',priority:'Medium',status:'Open'},
{id:'A-10',title:'보안 절차서 Gap 분석',assignee:'기술팀+QA',due_date:'2025-05-23',priority:'Medium',status:'Open'},
{id:'A-11',title:'완제품시험성적서 수령 일정 확인',assignee:'메디트릭스',due_date:'2025-05-09',priority:'Medium',status:'Open'},
{id:'A-12',title:'제조공정도 수정 사항 확정',assignee:'공통',due_date:'2025-05-22',priority:'Low',status:'Open'},
];

const SEED_MILESTONES=[
{id:'M-01',title:'기초 문서 1차 작성 완료',target_date:'2025-05-06',status:'Done',completion_rate:100,description:'bluemit_manual, 자산관리대장, 완제품시험절차서 등 완료'},
{id:'M-02',title:'조직 구성 확정 및 승인 체계 수립',target_date:'2025-05-09',status:'Active',completion_rate:20,description:'GMP 필수 직책 지정, 조직도 확정'},
{id:'M-03',title:'제품표준서 초안 전달',target_date:'2025-05-13',status:'Active',completion_rate:15,description:'5/13 확정 목표'},
{id:'M-04',title:'매뉴얼 3종 + 품질매뉴얼 완료',target_date:'2025-05-20',status:'Pending',completion_rate:30,description:''},
{id:'M-05',title:'템플릿 29종 + 신청문서 초안 완료',target_date:'2025-05-29',status:'Pending',completion_rate:3,description:'5/29 확정 목표'},
{id:'M-06',title:'내부 심사 및 문서 최종 완성',target_date:null,status:'Pending',completion_rate:0,description:'TBD'},
{id:'M-07',title:'GMP 인증 신청 제출',target_date:null,status:'Pending',completion_rate:0,description:'TBD'},
];

/* ══════════════════════════════════════════════════
   CSS
   ══════════════════════════════════════════════════ */
const CSS=`
:root{--bg:#0B1929;--bg2:#12253D;--bg3:#1C3556;--acc:#1A6EE8;--acc2:#3B8BFF;--cyan:#00C2D4;--wh:#F7F9FC;--g1:#EDF1F7;--g2:#D6DDE8;--g4:#8A9BB5;--g6:#4A5B73;--grn:#0DBF7E;--yel:#F5A623;--red:#E83030;--org:#E86A1A;--pur:#7C3AED;--brd:rgba(255,255,255,0.07);--sh:0 4px 24px rgba(0,0,0,0.18);}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--wh);font-family:'Noto Sans KR',sans-serif;font-size:13px;line-height:1.6;}
input,select,textarea,button{font-family:inherit;font-size:inherit;}
.app{display:flex;height:100vh;overflow:hidden;}
.sidebar{width:220px;background:var(--bg2);border-right:1px solid var(--brd);display:flex;flex-direction:column;flex-shrink:0;}
.sidebar-logo{padding:20px 16px;font-size:14px;font-weight:800;color:var(--cyan);border-bottom:1px solid var(--brd);letter-spacing:-0.3px;}
.sidebar-logo span{color:var(--acc2);font-size:11px;font-weight:500;display:block;margin-top:2px;letter-spacing:0.5px;text-transform:uppercase;}
.nav-item{padding:10px 16px;cursor:pointer;font-size:12.5px;font-weight:500;color:var(--g4);border-left:3px solid transparent;transition:all .15s;}
.nav-item:hover{background:rgba(255,255,255,0.04);color:var(--wh);}
.nav-item.active{background:rgba(26,110,232,0.12);color:var(--acc2);border-left-color:var(--acc2);font-weight:600;}
.nav-section{padding:16px 16px 6px;font-size:10px;font-weight:700;color:var(--g6);text-transform:uppercase;letter-spacing:1px;}
.main{flex:1;overflow-y:auto;background:var(--bg);}
.header{padding:20px 28px;border-bottom:1px solid var(--brd);display:flex;justify-content:space-between;align-items:center;background:var(--bg2);}
.header h1{font-size:18px;font-weight:700;letter-spacing:-0.3px;}
.header h1 em{font-style:normal;color:var(--acc2);}
.content{padding:24px 28px;}
.badge{display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:12px;font-size:10.5px;font-weight:600;white-space:nowrap;}
.badge::before{content:'';width:5px;height:5px;border-radius:50%;}
.card{background:var(--bg2);border:1px solid var(--brd);border-radius:8px;padding:16px 20px;}
.card h3{font-size:11px;font-weight:600;color:var(--cyan);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;}
.stat-big{font-size:28px;font-weight:800;font-family:'IBM Plex Mono',monospace;}
.stat-label{font-size:11px;color:var(--g4);margin-top:2px;}
.grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;}
.progress-bar{height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;margin-top:6px;}
.progress-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--acc),var(--cyan));transition:width .4s;}
.tbl{width:100%;border-collapse:collapse;font-size:12px;}
.tbl thead tr{background:rgba(26,110,232,0.08);}
.tbl th{padding:8px 10px;text-align:left;font-size:10.5px;font-weight:600;color:var(--acc2);letter-spacing:0.5px;text-transform:uppercase;white-space:nowrap;}
.tbl td{padding:8px 10px;border-top:1px solid rgba(255,255,255,0.04);vertical-align:top;}
.tbl tbody tr:hover{background:rgba(255,255,255,0.03);cursor:pointer;}
.tbl-wrap{background:var(--bg2);border:1px solid var(--brd);border-radius:8px;overflow:hidden;}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:center;}
.filters select,.filters input{background:var(--bg3);border:1px solid var(--brd);color:var(--wh);padding:6px 10px;border-radius:6px;font-size:11.5px;}
.filters input{width:200px;}
.btn{padding:6px 14px;border:none;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer;transition:all .15s;}
.btn-primary{background:var(--acc);color:white;}
.btn-primary:hover{background:var(--acc2);}
.btn-sm{padding:4px 10px;font-size:10.5px;}
.btn-ghost{background:transparent;color:var(--g4);border:1px solid var(--brd);}
.btn-ghost:hover{color:var(--wh);border-color:var(--g4);}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100;display:flex;align-items:center;justify-content:center;}
.modal{background:var(--bg2);border:1px solid var(--brd);border-radius:10px;width:90%;max-width:800px;max-height:85vh;overflow-y:auto;padding:24px;}
.modal h2{font-size:16px;margin-bottom:16px;display:flex;align-items:center;gap:10px;}
.modal-close{position:absolute;top:16px;right:20px;font-size:20px;cursor:pointer;color:var(--g4);background:none;border:none;}
.tabs{display:flex;gap:2px;border-bottom:1px solid var(--brd);margin-bottom:16px;}
.tab{padding:8px 16px;font-size:12px;font-weight:500;color:var(--g4);cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;}
.tab:hover{color:var(--wh);}
.tab.active{color:var(--acc2);border-bottom-color:var(--acc2);font-weight:600;}
.form-row{display:flex;gap:12px;margin-bottom:12px;}
.form-group{flex:1;}
.form-group label{display:block;font-size:10.5px;font-weight:600;color:var(--g4);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;}
.form-group input,.form-group select,.form-group textarea{width:100%;background:var(--bg3);border:1px solid var(--brd);color:var(--wh);padding:8px 10px;border-radius:6px;font-size:12px;}
.form-group textarea{min-height:60px;resize:vertical;}
.wg-chips{display:flex;flex-wrap:wrap;gap:4px;}
.wg-chip{display:inline-flex;align-items:center;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:600;background:rgba(26,110,232,0.12);color:var(--acc2);border:1px solid rgba(26,110,232,0.2);}
.overdue-tag{color:var(--red);font-weight:700;font-size:10px;}
.due-soon-tag{color:var(--org);font-weight:600;font-size:10px;}
.section-title{font-size:14px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px;}
.empty{text-align:center;padding:40px;color:var(--g4);font-size:13px;}
.wg-board-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;}
.wg-card{background:var(--bg2);border:1px solid var(--brd);border-radius:8px;padding:14px 16px;cursor:pointer;transition:all .15s;}
.wg-card:hover{border-color:var(--acc2);transform:translateY(-1px);}
.wg-card h4{font-size:13px;font-weight:700;margin-bottom:8px;color:var(--wh);}
.wg-stats{display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;color:var(--g4);}
.wg-stats span{display:flex;align-items:center;gap:4px;}
.ms-track{position:relative;padding:8px 0;}
.ms-item{display:flex;gap:16px;margin-bottom:16px;}
.ms-dot{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;font-weight:700;border:2px solid;}
.ms-content{flex:1;padding-top:4px;}
.ms-date{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--g4);}
.ms-name{font-size:13px;font-weight:600;margin-top:2px;}
.ms-desc{font-size:11.5px;color:rgba(247,249,252,0.6);margin-top:4px;}
.conn-status{display:flex;align-items:center;gap:6px;font-size:11px;}
.conn-dot{width:8px;height:8px;border-radius:50%;}
.risk-bar{position:absolute;left:0;top:0;width:3px;height:100%;border-radius:2px;}
.file-zone{border:2px dashed var(--brd);border-radius:8px;padding:28px 20px;text-align:center;cursor:pointer;transition:all .2s;position:relative;overflow:hidden;}
.file-zone:hover,.file-zone.drag{border-color:var(--acc2);background:rgba(26,110,232,0.06);}
.file-zone input{position:absolute;inset:0;opacity:0;cursor:pointer;}
.file-zone-label{font-size:12px;color:var(--g4);}
.file-zone-label strong{color:var(--acc2);}
.file-list{margin-top:14px;display:flex;flex-direction:column;gap:6px;}
.file-row{display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg3);border:1px solid var(--brd);border-radius:6px;transition:all .15s;}
.file-row:hover{border-color:var(--acc2);background:rgba(26,110,232,0.06);}
.file-icon{width:36px;height:36px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}
.file-info{flex:1;min-width:0;}
.file-info .fname{font-size:12.5px;font-weight:600;color:var(--wh);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.file-info .fmeta{font-size:10.5px;color:var(--g4);margin-top:2px;display:flex;gap:10px;flex-wrap:wrap;}
.file-actions{display:flex;gap:4px;flex-shrink:0;}
.file-actions button{width:30px;height:30px;border-radius:6px;border:1px solid var(--brd);background:transparent;color:var(--g4);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all .15s;}
.file-actions button:hover{background:var(--acc);color:white;border-color:var(--acc);}
.file-actions button.del:hover{background:var(--red);border-color:var(--red);}
.file-upload-progress{height:3px;background:rgba(255,255,255,0.08);border-radius:2px;margin-top:8px;overflow:hidden;}
.file-upload-fill{height:100%;background:var(--acc2);border-radius:2px;transition:width .3s;}
.file-badge{display:inline-flex;align-items:center;gap:3px;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;}
.file-version{background:rgba(0,194,212,0.15);color:var(--cyan);border:1px solid rgba(0,194,212,0.25);}
.file-latest{background:rgba(13,191,126,0.15);color:var(--grn);border:1px solid rgba(13,191,126,0.25);}
@media(max-width:900px){.grid-4{grid-template-columns:repeat(2,1fr);}.sidebar{width:180px;}}
@media(max-width:600px){.sidebar{display:none;}.grid-4,.grid-3{grid-template-columns:1fr;}}
`;

/* ══════════════════════════════════════════════════
   COMPONENTS
   ══════════════════════════════════════════════════ */
const Badge=({text,color})=>{const c=color||statusColor(text);return<span className="badge"style={{background:`${c}18`,color:c,border:`1px solid ${c}30`}}><span style={{display:'none'}}></span>{text}</span>;};
const ProgressBar=({value,color})=><div className="progress-bar"><div className="progress-fill"style={{width:`${value}%`,background:color||undefined}}/></div>;
const DueTag=({date})=>{if(!date)return null;const d=new Date(date),now=new Date(),diff=Math.ceil((d-now)/(1000*60*60*24));if(diff<0)return<span className="overdue-tag">⚠ {-diff}일 지연</span>;if(diff<=3)return<span className="due-soon-tag">⏰ D-{diff}</span>;return<span style={{fontSize:'11px',color:'#8A9BB5'}}>{date}</span>;};

function StatCard({label,value,color,sub}){return<div className="card"><div className="stat-big"style={{color:color||'var(--wh)'}}>{value}</div><div className="stat-label">{label}</div>{sub&&<div style={{fontSize:'10px',color:'var(--g4)',marginTop:4}}>{sub}</div>}</div>;}

/* ══════════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════════ */
function Dashboard({docs,issues,risks,actions,milestones}){
  const total=docs.length;
  const done=docs.filter(d=>['완료','승인완료'].includes(d.status)).length;
  const wip=docs.filter(d=>['작성중','부분완료','수정필요','검토중','초안완료','외부진행중','승인대기'].includes(d.status)).length;
  const notStarted=docs.filter(d=>d.status==='미착수').length;
  const overallProg=total?Math.round(docs.reduce((s,d)=>s+d.progress,0)/total):0;
  const critIssues=issues.filter(i=>i.severity==='Critical'&&i.status!=='Closed'&&i.status!=='Resolved').length;
  const now=new Date();
  const overdue=docs.filter(d=>d.due_date&&new Date(d.due_date)<now&&!['완료','승인완료'].includes(d.status));
  const dueSoon=docs.filter(d=>{if(!d.due_date||['완료','승인완료'].includes(d.status))return false;const diff=Math.ceil((new Date(d.due_date)-now)/(86400000));return diff>=0&&diff<=3;});
  const noApprover=docs.filter(d=>!d.approver||d.approver.trim()==='').length;
  const noOwner=docs.filter(d=>!d.primary_owner||d.primary_owner.trim()===''||d.primary_owner==='공통').length;
  const noFile=docs.filter(d=>!d.file_count||d.file_count===0).length;

  // 카테고리별 진행률
  const catMap={};docs.forEach(d=>{if(!catMap[d.category])catMap[d.category]={sum:0,cnt:0};catMap[d.category].sum+=d.progress;catMap[d.category].cnt++;});
  const catProgress=Object.entries(catMap).map(([k,v])=>({name:k,progress:Math.round(v.sum/v.cnt),count:v.cnt})).sort((a,b)=>b.progress-a.progress);

  // 업무군별
  const wgMap={};docs.forEach(d=>(d.work_groups||[]).forEach(w=>{if(!wgMap[w])wgMap[w]={sum:0,cnt:0};wgMap[w].sum+=d.progress;wgMap[w].cnt++;}));
  const wgProgress=Object.entries(wgMap).map(([k,v])=>({name:k,progress:Math.round(v.sum/v.cnt),count:v.cnt})).sort((a,b)=>b.count-a.count).slice(0,10);

  return<div>
    <div className="section-title">📊 전체 현황 대시보드</div>
    <div className="grid-4"style={{marginBottom:16}}>
      <StatCard label="총 문서"value={total}/>
      <StatCard label="완료"value={done}color="var(--grn)"/>
      <StatCard label="작성중/수정필요"value={wip}color="var(--acc2)"/>
      <StatCard label="미착수"value={notStarted}color="var(--g4)"/>
    </div>
    <div className="grid-4"style={{marginBottom:16}}>
      <StatCard label="전체 진행률"value={`${overallProg}%`}color="var(--cyan)"/>
      <StatCard label="Critical 이슈"value={critIssues}color="var(--red)"/>
      <StatCard label="지연 문서"value={overdue.length}color="var(--red)"/>
      <StatCard label="마감 임박 (3일 이내)"value={dueSoon.length}color="var(--org)"/>
    </div>
    <div className="grid-4"style={{marginBottom:16}}>
      <StatCard label="승인자 미지정"value={noApprover}color="var(--yel)"/>
      <StatCard label="파일 미첨부 문서"value={noFile}color="var(--org)"sub="📎 파일이 없는 문서"/>
      <StatCard label="외부 진행중"value={docs.filter(d=>d.status==='외부진행중').length}color="var(--acc2)"/>
      <StatCard label="미완료 Action Items"value={actions.filter(a=>a.status!=='Done'&&a.status!=='Cancelled').length}color="var(--yel)"/>
    </div>

    <div className="grid-2"style={{marginBottom:16}}>
      <div className="card">
        <h3>카테고리별 진행률</h3>
        {catProgress.map(c=><div key={c.name}style={{marginBottom:8}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:'11px',marginBottom:3}}>
            <span style={{color:'var(--g4)'}}>{c.name} ({c.count}종)</span>
            <strong>{c.progress}%</strong>
          </div>
          <ProgressBar value={c.progress} color={c.progress<30?'linear-gradient(90deg,#E83030,#F87171)':c.progress<70?'linear-gradient(90deg,#F5A623,#E86A1A)':undefined}/>
        </div>)}
      </div>
      <div className="card">
        <h3>업무군별 문서 현황 (TOP 10)</h3>
        {wgProgress.map(w=><div key={w.name}style={{marginBottom:8}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:'11px',marginBottom:3}}>
            <span style={{color:'var(--g4)'}}>{w.name} ({w.count}건)</span>
            <strong>{w.progress}%</strong>
          </div>
          <ProgressBar value={w.progress}/>
        </div>)}
      </div>
    </div>

    {(overdue.length>0||dueSoon.length>0)&&<div className="card"style={{marginBottom:16}}>
      <h3>🚨 긴급 주의 문서</h3>
      {overdue.map(d=><div key={d.id}style={{display:'flex',gap:8,alignItems:'center',marginBottom:6,fontSize:'12px'}}>
        <span className="overdue-tag">지연</span><strong>{d.doc_name}</strong><span style={{color:'var(--g4)'}}>마감: {d.due_date}</span>
      </div>)}
      {dueSoon.map(d=><div key={d.id}style={{display:'flex',gap:8,alignItems:'center',marginBottom:6,fontSize:'12px'}}>
        <span className="due-soon-tag">임박</span><strong>{d.doc_name}</strong><span style={{color:'var(--g4)'}}>마감: {d.due_date}</span>
      </div>)}
    </div>}

    {critIssues>0&&<div className="card"style={{marginBottom:16,borderLeft:'3px solid var(--red)'}}>
      <h3>🔴 Critical 이슈</h3>
      {issues.filter(i=>i.severity==='Critical'&&i.status!=='Closed').map(i=><div key={i.id}style={{marginBottom:8}}>
        <div style={{fontWeight:600,fontSize:'12.5px'}}>{i.id} — {i.title}</div>
        <div style={{fontSize:'11px',color:'var(--g4)',marginTop:2}}>{i.description?.slice(0,120)}...</div>
      </div>)}
    </div>}

    <div className="card">
      <h3>📅 마일스톤 현황</h3>
      {milestones.map(m=><div key={m.id}style={{display:'flex',gap:12,alignItems:'center',marginBottom:10}}>
        <Badge text={m.status}/>
        <div style={{flex:1}}>
          <div style={{fontWeight:600,fontSize:'12px'}}>{m.title}</div>
          <div style={{fontSize:'10.5px',color:'var(--g4)'}}>{m.target_date||'TBD'}</div>
        </div>
        <div style={{width:80}}><ProgressBar value={m.completion_rate}/></div>
        <span style={{fontSize:'11px',fontFamily:'IBM Plex Mono',fontWeight:600}}>{m.completion_rate}%</span>
      </div>)}
    </div>
  </div>;
}

/* ══════════════════════════════════════════════════
   DOCUMENT LIST
   ══════════════════════════════════════════════════ */
function DocList({docs,onSelect}){
  const[filter,setF]=useState({cat:'',status:'',wg:'',priority:'',q:''});
  const filtered=useMemo(()=>{
    let r=docs;
    if(filter.cat)r=r.filter(d=>d.category===filter.cat);
    if(filter.status)r=r.filter(d=>d.status===filter.status);
    if(filter.priority)r=r.filter(d=>d.priority===filter.priority);
    if(filter.wg)r=r.filter(d=>(d.work_groups||[]).includes(filter.wg));
    if(filter.q){const q=filter.q.toLowerCase();r=r.filter(d=>d.doc_name.toLowerCase().includes(q)||d.id.toLowerCase().includes(q)||(d.notes||'').toLowerCase().includes(q));}
    return r;
  },[docs,filter]);

  return<div>
    <div className="section-title">📄 문서 관리 <span style={{fontSize:'11px',color:'var(--g4)',fontWeight:400}}>({filtered.length}/{docs.length}건)</span></div>
    <div className="filters">
      <input placeholder="🔍 문서명 / ID 검색"value={filter.q}onChange={e=>setF(p=>({...p,q:e.target.value}))}/>
      <select value={filter.cat}onChange={e=>setF(p=>({...p,cat:e.target.value}))}><option value="">전체 카테고리</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>
      <select value={filter.status}onChange={e=>setF(p=>({...p,status:e.target.value}))}><option value="">전체 상태</option>{DOC_STATUSES.map(s=><option key={s}>{s}</option>)}</select>
      <select value={filter.priority}onChange={e=>setF(p=>({...p,priority:e.target.value}))}><option value="">전체 우선순위</option>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</select>
      <select value={filter.wg}onChange={e=>setF(p=>({...p,wg:e.target.value}))}><option value="">전체 업무군</option>{WORK_GROUPS.map(w=><option key={w}>{w}</option>)}</select>
      <button className="btn btn-ghost btn-sm"onClick={()=>setF({cat:'',status:'',wg:'',priority:'',q:''})}>초기화</button>
    </div>
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr>
          <th>ID</th><th>문서명</th><th>카테고리</th><th>상태</th><th>진행률</th>
          <th>담당</th><th>업무군</th><th>우선순위</th><th>📎</th><th>마감일</th><th>비고</th>
        </tr></thead>
        <tbody>
          {filtered.length===0&&<tr><td colSpan={11}className="empty">조건에 맞는 문서가 없습니다</td></tr>}
          {filtered.map(d=><tr key={d.id}onClick={()=>onSelect(d)}>
            <td style={{fontFamily:'IBM Plex Mono',fontSize:'11px',color:'var(--g4)'}}>{d.id}</td>
            <td style={{fontWeight:600,maxWidth:220}}>{d.doc_name}</td>
            <td style={{fontSize:'11px'}}>{d.category}</td>
            <td><Badge text={d.status}/></td>
            <td style={{width:80}}><div style={{display:'flex',alignItems:'center',gap:6}}><ProgressBar value={d.progress}/><span style={{fontSize:'10px',fontWeight:600,minWidth:28}}>{d.progress}%</span></div></td>
            <td style={{fontSize:'11px'}}>{d.primary_owner||d.owner_org}</td>
            <td><div className="wg-chips">{(d.work_groups||[]).slice(0,3).map(w=><span key={w}className="wg-chip">{w}</span>)}{(d.work_groups||[]).length>3&&<span className="wg-chip">+{(d.work_groups||[]).length-3}</span>}</div></td>
            <td>{priorityIcon(d.priority)} <span style={{fontSize:'11px'}}>{d.priority}</span></td>
            <td style={{textAlign:'center'}}>{(d.file_count||0)>0?<span className="file-badge file-latest">📎 {d.file_count}</span>:<span style={{color:'var(--g6)',fontSize:'10px'}}>—</span>}</td>
            <td><DueTag date={d.due_date}/></td>
            <td style={{fontSize:'11px',color:'var(--g4)',maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.remaining_tasks||d.notes}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </div>;
}

/* ══════════════════════════════════════════════════
   DOCUMENT DETAIL MODAL
   ══════════════════════════════════════════════════ */
function DocDetail({doc,onClose,onUpdate,connected}){
  const[tab,setTab]=useState('info');
  const[form,setForm]=useState({...doc});
  const[files,setFiles]=useState([]);
  const[uploading,setUploading]=useState(false);
  const[uploadPct,setUploadPct]=useState(0);
  const[drag,setDrag]=useState(false);
  const[fileDesc,setFileDesc]=useState('');
  const[fileVer,setFileVer]=useState('v1.0');
  const fileRef=useRef(null);
  const tabs=[{k:'info',l:'기본정보'},{k:'status',l:'작성현황'},{k:'files',l:`📎 파일첨부 (${files.length})`},{k:'wg',l:'업무군'},{k:'issues',l:'이슈/잔여과업'},{k:'notes',l:'메모/비고'}];

  // 파일 목록 로드
  useEffect(()=>{
    if(!supabase||!connected)return;
    (async()=>{
      const{data}=await supabase.from('file_attachments').select('*').eq('document_id',doc.id).order('created_at',{ascending:false});
      if(data)setFiles(data);
    })();
  },[doc.id,connected]);

  const getFileIcon=(name)=>{
    const ext=(name||'').split('.').pop().toLowerCase();
    const map={pdf:'📕',doc:'📘',docx:'📘',xls:'📗',xlsx:'📗',ppt:'📙',pptx:'📙',zip:'📦',rar:'📦','7z':'📦',
      png:'🖼️',jpg:'🖼️',jpeg:'🖼️',gif:'🖼️',svg:'🖼️',webp:'🖼️',
      txt:'📄',md:'📄',csv:'📄',json:'📄',xml:'📄',html:'📄',
      hwp:'📘',hwpx:'📘'};
    return map[ext]||'📎';
  };
  const fmtSize=(bytes)=>{if(!bytes)return'—';if(bytes<1024)return bytes+'B';if(bytes<1048576)return(bytes/1024).toFixed(1)+'KB';return(bytes/1048576).toFixed(1)+'MB';};

  const uploadFiles=async(fileList)=>{
    if(!supabase||!connected){alert('Supabase에 연결되어야 파일을 업로드할 수 있습니다.');return;}
    if(!fileList||fileList.length===0)return;
    setUploading(true);setUploadPct(0);
    const total=fileList.length;
    let done=0;
    for(const file of fileList){
      try{
        const ts=Date.now();
        // 확장자 분리
        const lastDot=file.name.lastIndexOf('.');
        const ext=lastDot>0?file.name.slice(lastDot):'';
        // 스토리지 경로는 ASCII만 사용 (한글/특수문자 제거, 원본 파일명은 DB에 보존)
        const asciiPart=file.name.replace(ext,'').replace(/[^a-zA-Z0-9]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'')||'file';
        const storagePath=`${doc.id}/${ts}_${asciiPart}${ext.toLowerCase()}`;
        const{error:upErr}=await supabase.storage.from('gmp-files').upload(storagePath,file,{cacheControl:'3600',upsert:false});
        if(upErr){console.error('Upload error:',upErr);alert(`업로드 실패: ${file.name}\n${upErr.message}`);continue;}
        const{data:urlData}=supabase.storage.from('gmp-files').getPublicUrl(storagePath);
        const publicUrl=urlData?.publicUrl||'';
        const row={document_id:doc.id,file_name:file.name,file_path:storagePath,file_size:file.size,file_type:file.type||ext.replace('.',''),version:fileVer,uploader:'사용자',description:fileDesc,is_latest:true,public_url:publicUrl};
        // 기존 같은 이름 파일의 is_latest를 false로
        await supabase.from('file_attachments').update({is_latest:false}).eq('document_id',doc.id).eq('file_name',file.name);
        const{data:inserted,error:dbErr}=await supabase.from('file_attachments').insert(row).select();
        if(dbErr){console.error('DB insert error:',dbErr);alert(`파일 DB 등록 실패: ${file.name}\n${dbErr.message}`);continue;}
        if(inserted)setFiles(prev=>[...inserted,...prev.map(f=>f.file_name===file.name?{...f,is_latest:false}:f)]);
      }catch(err){
        console.error('Upload exception:',err);
        alert(`업로드 중 오류 발생: ${file.name}\n${err.message||err}`);
      }
      done++;setUploadPct(Math.round(done/total*100));
    }
    setUploading(false);setFileDesc('');
  };

  const downloadFile=async(f)=>{
    if(!supabase||!connected){alert('Supabase 연결이 필요합니다.');return;}
    try{
      // 먼저 direct download 시도 (public_url 인코딩 문제 우회)
      const{data,error}=await supabase.storage.from('gmp-files').download(f.file_path);
      if(error){
        // fallback: public URL로 시도
        if(f.public_url){window.open(f.public_url,'_blank');return;}
        alert('다운로드 실패: '+error.message);return;
      }
      const url=URL.createObjectURL(data);
      const a=document.createElement('a');a.href=url;a.download=f.file_name;document.body.appendChild(a);a.click();document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(err){
      alert('다운로드 중 오류: '+(err.message||err));
    }
  };

  const deleteFile=async(f)=>{
    if(!confirm(`"${f.file_name}" 파일을 삭제하시겠습니까?`))return;
    try{
      if(supabase&&connected){
        const{error:stErr}=await supabase.storage.from('gmp-files').remove([f.file_path]);
        if(stErr)console.warn('Storage delete warning:',stErr);
        const{error:dbErr}=await supabase.from('file_attachments').delete().eq('id',f.id);
        if(dbErr){alert('파일 삭제 실패: '+dbErr.message);return;}
      }
      setFiles(prev=>prev.filter(x=>x.id!==f.id));
    }catch(err){
      alert('삭제 중 오류: '+(err.message||err));
    }
  };

  const handleDrop=(e)=>{e.preventDefault();setDrag(false);uploadFiles(e.dataTransfer.files);};
  const handleDragOver=(e)=>{e.preventDefault();setDrag(true);};
  const handleDragLeave=()=>setDrag(false);

  const save=()=>{onUpdate({...form,file_count:files.length});onClose();};

  return<div className="modal-overlay"onClick={onClose}><div className="modal"onClick={e=>e.stopPropagation()}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
      <div>
        <div style={{fontSize:'11px',color:'var(--g4)',fontFamily:'IBM Plex Mono'}}>{form.id}</div>
        <h2 style={{margin:0}}>{form.doc_name}</h2>
        <div style={{display:'flex',gap:8,marginTop:6}}><Badge text={form.status}/><Badge text={form.priority}/>{files.length>0&&<span className="file-badge file-latest">📎 {files.length}건</span>}</div>
      </div>
      <button onClick={onClose}style={{background:'none',border:'none',color:'var(--g4)',fontSize:'20px',cursor:'pointer'}}>✕</button>
    </div>
    <div className="tabs">{tabs.map(t=><div key={t.k}className={`tab ${tab===t.k?'active':''}`}onClick={()=>setTab(t.k)}>{t.l}</div>)}</div>

    {tab==='info'&&<div>
      <div className="form-row">
        <div className="form-group"><label>문서명</label><input value={form.doc_name}onChange={e=>setForm(p=>({...p,doc_name:e.target.value}))}/></div>
        <div className="form-group"><label>카테고리</label><select value={form.category}onChange={e=>setForm(p=>({...p,category:e.target.value}))}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>담당 조직</label><input value={form.owner_org||''}onChange={e=>setForm(p=>({...p,owner_org:e.target.value}))}/></div>
        <div className="form-group"><label>주 담당자</label><input value={form.primary_owner||''}onChange={e=>setForm(p=>({...p,primary_owner:e.target.value}))}/></div>
        <div className="form-group"><label>담당 그룹</label><input value={form.owner_group||''}onChange={e=>setForm(p=>({...p,owner_group:e.target.value}))}/></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>검토자</label><input value={form.reviewer||''}onChange={e=>setForm(p=>({...p,reviewer:e.target.value}))}/></div>
        <div className="form-group"><label>승인자</label><input value={form.approver||''}onChange={e=>setForm(p=>({...p,approver:e.target.value}))}/></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>마감일</label><input type="date"value={form.due_date||''}onChange={e=>setForm(p=>({...p,due_date:e.target.value}))}/></div>
        <div className="form-group"><label>우선순위</label><select value={form.priority}onChange={e=>setForm(p=>({...p,priority:e.target.value}))}>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</select></div>
        <div className="form-group"><label>관련 표준</label><input value={form.related_standard||''}onChange={e=>setForm(p=>({...p,related_standard:e.target.value}))}/></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>선행 조건</label><textarea value={form.preconditions||''}onChange={e=>setForm(p=>({...p,preconditions:e.target.value}))}/></div>
        <div className="form-group"><label>의존 문서</label><textarea value={form.dependency_docs||''}onChange={e=>setForm(p=>({...p,dependency_docs:e.target.value}))}/></div>
      </div>
    </div>}

    {tab==='status'&&<div>
      <div className="form-row">
        <div className="form-group"><label>상태</label><select value={form.status}onChange={e=>setForm(p=>({...p,status:e.target.value}))}>{DOC_STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
        <div className="form-group"><label>진행률 ({form.progress}%)</label><input type="range"min={0}max={100}value={form.progress}onChange={e=>setForm(p=>({...p,progress:+e.target.value}))}/></div>
      </div>
      <ProgressBar value={form.progress}/>
      <div style={{marginTop:16}}>
        <div className="form-group"><label>완료기준 (Definition of Done)</label><textarea value={form.definition_of_done||''}onChange={e=>setForm(p=>({...p,definition_of_done:e.target.value}))}/></div>
      </div>
    </div>}

    {tab==='files'&&<div>
      {/* 업로드 영역 */}
      <div className={`file-zone ${drag?'drag':''}`}onDrop={handleDrop}onDragOver={handleDragOver}onDragLeave={handleDragLeave}onClick={()=>fileRef.current?.click()}>
        <input ref={fileRef}type="file"multiple onChange={e=>uploadFiles(e.target.files)}/>
        <div className="file-zone-label">
          {uploading?<>⏳ 업로드 중... ({uploadPct}%)</>:<>📂 <strong>클릭</strong>하거나 파일을 <strong>드래그&드롭</strong>하여 업로드<br/><span style={{fontSize:'10.5px',marginTop:4,display:'block'}}>PDF, DOCX, HWP, XLSX, PPTX, 이미지, ZIP 등 모든 파일 형식 가능</span></>}
        </div>
        {uploading&&<div className="file-upload-progress"><div className="file-upload-fill"style={{width:`${uploadPct}%`}}/></div>}
      </div>
      {/* 업로드 옵션 */}
      <div className="form-row"style={{marginTop:12}}>
        <div className="form-group"><label>파일 버전</label><input value={fileVer}onChange={e=>setFileVer(e.target.value)}placeholder="v1.0"/></div>
        <div className="form-group"><label>파일 설명 (선택)</label><input value={fileDesc}onChange={e=>setFileDesc(e.target.value)}placeholder="파일에 대한 설명을 입력하세요"/></div>
      </div>
      {/* 연결 상태 안내 */}
      {!connected&&<div style={{marginTop:10,padding:'10px 14px',borderRadius:6,background:'rgba(245,166,35,0.1)',border:'1px solid rgba(245,166,35,0.25)',fontSize:'11.5px',color:'var(--yel)'}}>⚠️ Supabase에 연결되지 않은 상태에서는 파일 업로드/다운로드를 사용할 수 없습니다. 환경변수를 설정하고 연결하세요.</div>}
      {/* 파일 목록 */}
      <div style={{marginTop:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontSize:'12px',fontWeight:600,color:'var(--g4)'}}>첨부파일 목록 ({files.length}건)</div>
        {files.length>0&&<div style={{fontSize:'10.5px',color:'var(--g6)'}}>총 {fmtSize(files.reduce((s,f)=>s+(f.file_size||0),0))}</div>}
      </div>
      {files.length===0?<div className="empty"style={{padding:'24px',fontSize:'12px'}}>첨부된 파일이 없습니다</div>:
      <div className="file-list">
        {files.map(f=><div key={f.id}className="file-row">
          <div className="file-icon"style={{background:'rgba(26,110,232,0.1)',color:'var(--acc2)'}}>{getFileIcon(f.file_name)}</div>
          <div className="file-info">
            <div className="fname">{f.file_name}</div>
            <div className="fmeta">
              <span>{fmtSize(f.file_size)}</span>
              <span>🏷️ {f.version||'v1.0'}</span>
              <span>👤 {f.uploader||'—'}</span>
              <span>📅 {f.created_at?new Date(f.created_at).toLocaleDateString('ko-KR'):'-'}</span>
              {f.is_latest&&<span className="file-badge file-latest">최신</span>}
            </div>
            {f.description&&<div style={{fontSize:'10.5px',color:'var(--g4)',marginTop:3}}>{f.description}</div>}
          </div>
          <div className="file-actions">
            <button title="다운로드"onClick={()=>downloadFile(f)}>⬇</button>
            <button className="del"title="삭제"onClick={()=>deleteFile(f)}>🗑</button>
          </div>
        </div>)}
      </div>}
    </div>}

    {tab==='wg'&&<div>
      <div className="form-group"><label>담당 업무군 (클릭으로 토글)</label></div>
      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:8}}>
        {WORK_GROUPS.map(w=>{const active=(form.work_groups||[]).includes(w);return<button key={w}className={`wg-chip`}style={{cursor:'pointer',background:active?'rgba(26,110,232,0.25)':'rgba(255,255,255,0.04)',color:active?'var(--acc2)':'var(--g4)',border:active?'1px solid var(--acc2)':'1px solid var(--brd)'}}
          onClick={()=>{const wgs=form.work_groups||[];setForm(p=>({...p,work_groups:active?wgs.filter(x=>x!==w):[...wgs,w]}));}}>{w}</button>;})}
      </div>
    </div>}

    {tab==='issues'&&<div>
      <div className="form-group"><label>잔여 과업</label><textarea rows={3}value={form.remaining_tasks||''}onChange={e=>setForm(p=>({...p,remaining_tasks:e.target.value}))}/></div>
      <div className="form-group"style={{marginTop:12}}><label>현재 병목 / 요청사항</label><textarea rows={3}value={form.notes||''}onChange={e=>setForm(p=>({...p,notes:e.target.value}))}/></div>
    </div>}

    {tab==='notes'&&<div>
      <div className="form-group"><label>비고 / 메모</label><textarea rows={5}value={form.notes||''}onChange={e=>setForm(p=>({...p,notes:e.target.value}))}/></div>
      <div className="form-group"style={{marginTop:12}}><label>설명</label><textarea rows={3}value={form.description||''}onChange={e=>setForm(p=>({...p,description:e.target.value}))}/></div>
    </div>}

    <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:20,paddingTop:16,borderTop:'1px solid var(--brd)'}}>
      <button className="btn btn-ghost"onClick={onClose}>취소</button>
      <button className="btn btn-primary"onClick={save}>💾 저장</button>
    </div>
  </div></div>;
}

/* ══════════════════════════════════════════════════
   ISSUES LIST
   ══════════════════════════════════════════════════ */
function IssueList({issues,onUpdate,onAdd,onDelete}){
  const[editId,setEditId]=useState(null);
  const[showNew,setShowNew]=useState(false);
  return<div>
    <div className="section-title"style={{display:'flex',justifyContent:'space-between'}}>
      <span>⚠️ 이슈 관리 <span style={{fontSize:'11px',color:'var(--g4)',fontWeight:400}}>({issues.length}건)</span></span>
      <button className="btn btn-primary btn-sm"onClick={()=>setShowNew(true)}>+ 새 이슈</button>
    </div>
    <div className="tbl-wrap"><table className="tbl">
      <thead><tr><th>ID</th><th>제목</th><th>심각도</th><th>상태</th><th>마감일</th><th>의사결정</th><th>설명</th><th style={{width:40}}></th></tr></thead>
      <tbody>{issues.map(i=><tr key={i.id}>
        <td style={{fontFamily:'IBM Plex Mono',fontSize:'11px',cursor:'pointer'}}onClick={()=>setEditId(i.id)}>{i.id}</td>
        <td style={{fontWeight:600,cursor:'pointer'}}onClick={()=>setEditId(i.id)}>{i.title}</td>
        <td><Badge text={i.severity}/></td>
        <td><Badge text={i.status}/></td>
        <td><DueTag date={i.due_date}/></td>
        <td>{i.decision_needed?<span style={{color:'var(--org)',fontWeight:600,fontSize:'11px'}}>📋 필요</span>:<span style={{color:'var(--g4)',fontSize:'11px'}}>—</span>}</td>
        <td style={{fontSize:'11px',color:'var(--g4)',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{i.description}</td>
        <td><button className="btn btn-ghost btn-sm"style={{color:'var(--red)',padding:'2px 6px'}}onClick={e=>{e.stopPropagation();if(confirm(`"${i.title}" 이슈를 삭제하시겠습니까?`))onDelete(i.id);}}>🗑</button></td>
      </tr>)}</tbody>
    </table></div>
    {editId&&<IssueEditModal issue={issues.find(i=>i.id===editId)} onClose={()=>setEditId(null)} onUpdate={onUpdate}/>}
    {showNew&&<IssueEditModal issue={{id:nextId(issues,'ISSUE-',3),title:'',severity:'Medium',status:'Open',due_date:'',description:'',decision_needed:false,assignee:'',assignee_group:''}} onClose={()=>setShowNew(false)} onUpdate={i=>{onAdd(i);setShowNew(false);}} isNew/>}
  </div>;
}

function IssueEditModal({issue,onClose,onUpdate,isNew}){
  const[form,setForm]=useState({...issue});
  return<div className="modal-overlay"onClick={onClose}><div className="modal"onClick={e=>e.stopPropagation()}>
    <h2>{isNew?'➕ 새 이슈 등록':`${form.id} — 이슈 편집`}</h2>
    <div className="form-row">
      <div className="form-group"><label>이슈 ID</label><input value={form.id}onChange={e=>setForm(p=>({...p,id:e.target.value}))} disabled={!isNew}style={!isNew?{opacity:0.6,cursor:'not-allowed'}:{}}/></div>
      <div className="form-group"><label>제목</label><input value={form.title}onChange={e=>setForm(p=>({...p,title:e.target.value}))}/></div>
    </div>
    <div className="form-row">
      <div className="form-group"><label>심각도</label><select value={form.severity}onChange={e=>setForm(p=>({...p,severity:e.target.value}))}>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</select></div>
      <div className="form-group"><label>상태</label><select value={form.status}onChange={e=>setForm(p=>({...p,status:e.target.value}))}>{ISSUE_STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
      <div className="form-group"><label>마감일</label><input type="date"value={form.due_date||''}onChange={e=>setForm(p=>({...p,due_date:e.target.value}))}/></div>
    </div>
    <div className="form-row">
      <div className="form-group"><label>담당자</label><input value={form.assignee||''}onChange={e=>setForm(p=>({...p,assignee:e.target.value}))}/></div>
      <div className="form-group"><label>담당 그룹</label><input value={form.assignee_group||''}onChange={e=>setForm(p=>({...p,assignee_group:e.target.value}))}/></div>
      <div className="form-group"><label>의사결정 필요</label><select value={form.decision_needed?'true':'false'}onChange={e=>setForm(p=>({...p,decision_needed:e.target.value==='true'}))}><option value="false">아니오</option><option value="true">예</option></select></div>
    </div>
    <div className="form-group"><label>설명</label><textarea rows={4}value={form.description||''}onChange={e=>setForm(p=>({...p,description:e.target.value}))}/></div>
    <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
      <button className="btn btn-ghost"onClick={onClose}>취소</button>
      <button className="btn btn-primary"onClick={()=>{if(!form.title.trim()){alert('제목을 입력하세요.');return;}onUpdate(form);if(!isNew)onClose();}}>{isNew?'➕ 등록':'💾 저장'}</button>
    </div>
  </div></div>;
}

/* ══════════════════════════════════════════════════
   RISK LIST
   ══════════════════════════════════════════════════ */
const RISK_LEVELS=['Critical','High','Medium','Low'];
const RISK_STATUSES=['Open','Mitigating','Resolved','Accepted','Closed'];

function RiskList({risks,onUpdate,onAdd,onDelete}){
  const[editId,setEditId]=useState(null);
  const[showNew,setShowNew]=useState(false);
  return<div>
    <div className="section-title"style={{display:'flex',justifyContent:'space-between'}}>
      <span>🛡️ 리스크 관리 <span style={{fontSize:'11px',color:'var(--g4)',fontWeight:400}}>({risks.length}건)</span></span>
      <button className="btn btn-primary btn-sm"onClick={()=>setShowNew(true)}>+ 새 리스크</button>
    </div>
    <div className="grid-2">{risks.map(r=><div key={r.id}className="card"style={{position:'relative',overflow:'hidden',cursor:'pointer'}}onClick={()=>setEditId(r.id)}>
      <div className="risk-bar"style={{background:statusColor(r.level)}}/>
      <div style={{paddingLeft:10}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <span style={{fontFamily:'IBM Plex Mono',fontSize:'10px',color:'var(--g4)'}}>{r.id}</span>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <Badge text={r.level}/>
            <Badge text={r.status||'Open'}/>
            <button className="btn btn-ghost btn-sm"style={{color:'var(--red)',padding:'2px 6px'}}onClick={e=>{e.stopPropagation();if(confirm(`"${r.title}" 리스크를 삭제하시겠습니까?`))onDelete(r.id);}}>🗑</button>
          </div>
        </div>
        <div style={{fontWeight:700,fontSize:'13px',marginBottom:6}}>{r.title}</div>
        <div style={{fontSize:'11.5px',color:'rgba(247,249,252,0.65)',marginBottom:8}}>{r.description}</div>
        <div style={{fontSize:'11px',color:'var(--cyan)',borderTop:'1px solid var(--brd)',paddingTop:8}}>
          <strong>대응:</strong> {r.mitigation}
        </div>
      </div>
    </div>)}</div>
    {editId&&<RiskEditModal risk={risks.find(r=>r.id===editId)} onClose={()=>setEditId(null)} onUpdate={r=>{onUpdate(r);setEditId(null);}}/>}
    {showNew&&<RiskEditModal risk={{id:nextId(risks,'R-',2),title:'',level:'Medium',status:'Open',description:'',mitigation:''}} onClose={()=>setShowNew(false)} onUpdate={r=>{onAdd(r);setShowNew(false);}} isNew/>}
  </div>;
}

function RiskEditModal({risk,onClose,onUpdate,isNew}){
  const[form,setForm]=useState({...risk});
  return<div className="modal-overlay"onClick={onClose}><div className="modal"onClick={e=>e.stopPropagation()}>
    <h2>{isNew?'➕ 새 리스크 등록':`${form.id} — 리스크 편집`}</h2>
    <div className="form-row">
      <div className="form-group"><label>리스크 ID</label><input value={form.id}onChange={e=>setForm(p=>({...p,id:e.target.value}))} disabled={!isNew}style={!isNew?{opacity:0.6,cursor:'not-allowed'}:{}}/></div>
      <div className="form-group"><label>제목</label><input value={form.title}onChange={e=>setForm(p=>({...p,title:e.target.value}))}/></div>
    </div>
    <div className="form-row">
      <div className="form-group"><label>등급</label><select value={form.level}onChange={e=>setForm(p=>({...p,level:e.target.value}))}>{RISK_LEVELS.map(l=><option key={l}>{l}</option>)}</select></div>
      <div className="form-group"><label>상태</label><select value={form.status||'Open'}onChange={e=>setForm(p=>({...p,status:e.target.value}))}>{RISK_STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
    </div>
    <div className="form-group"><label>설명</label><textarea rows={3}value={form.description||''}onChange={e=>setForm(p=>({...p,description:e.target.value}))}/></div>
    <div className="form-group"><label>대응 방안</label><textarea rows={3}value={form.mitigation||''}onChange={e=>setForm(p=>({...p,mitigation:e.target.value}))}/></div>
    <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
      <button className="btn btn-ghost"onClick={onClose}>취소</button>
      <button className="btn btn-primary"onClick={()=>{if(!form.title.trim()){alert('제목을 입력하세요.');return;}onUpdate(form);}}>{isNew?'➕ 등록':'💾 저장'}</button>
    </div>
  </div></div>;
}

/* ══════════════════════════════════════════════════
   ACTION ITEMS
   ══════════════════════════════════════════════════ */
function ActionList({actions,onUpdate,onAdd,onDelete}){
  const[editId,setEditId]=useState(null);
  const[showNew,setShowNew]=useState(false);
  return<div>
    <div className="section-title"style={{display:'flex',justifyContent:'space-between'}}>
      <span>🎯 Action Items <span style={{fontSize:'11px',color:'var(--g4)',fontWeight:400}}>({actions.length}건)</span></span>
      <button className="btn btn-primary btn-sm"onClick={()=>setShowNew(true)}>+ 새 액션</button>
    </div>
    <div className="tbl-wrap"><table className="tbl">
      <thead><tr><th>ID</th><th>과업명</th><th>담당</th><th>기한</th><th>우선순위</th><th>상태</th><th style={{width:80}}>액션</th></tr></thead>
      <tbody>{actions.map(a=><tr key={a.id}>
        <td style={{fontFamily:'IBM Plex Mono',fontSize:'11px',color:statusColor(a.priority),cursor:'pointer'}}onClick={()=>setEditId(a.id)}>{a.id}</td>
        <td style={{fontWeight:600,cursor:'pointer'}}onClick={()=>setEditId(a.id)}>{a.title}</td>
        <td style={{fontSize:'11px'}}>{a.assignee}</td>
        <td><DueTag date={a.due_date}/></td>
        <td>{priorityIcon(a.priority)} {a.priority}</td>
        <td><select className="btn btn-ghost btn-sm"value={a.status}onChange={e=>onUpdate({...a,status:e.target.value})}>{ACTION_STATUSES.map(s=><option key={s}>{s}</option>)}</select></td>
        <td><button className="btn btn-ghost btn-sm"style={{color:'var(--red)',padding:'2px 6px'}}onClick={()=>{if(confirm(`"${a.title}" 액션을 삭제하시겠습니까?`))onDelete(a.id);}}>🗑</button></td>
      </tr>)}</tbody>
    </table></div>
    {editId&&<ActionEditModal action={actions.find(a=>a.id===editId)} onClose={()=>setEditId(null)} onUpdate={a=>{onUpdate(a);setEditId(null);}}/>}
    {showNew&&<ActionEditModal action={{id:nextId(actions,'A-',2),title:'',assignee:'',due_date:'',priority:'Medium',status:'Open'}} onClose={()=>setShowNew(false)} onUpdate={a=>{onAdd(a);setShowNew(false);}} isNew/>}
  </div>;
}

function ActionEditModal({action,onClose,onUpdate,isNew}){
  const[form,setForm]=useState({...action});
  return<div className="modal-overlay"onClick={onClose}><div className="modal"onClick={e=>e.stopPropagation()}>
    <h2>{isNew?'➕ 새 액션 등록':`${form.id} — 액션 편집`}</h2>
    <div className="form-row">
      <div className="form-group"><label>액션 ID</label><input value={form.id}onChange={e=>setForm(p=>({...p,id:e.target.value}))} disabled={!isNew}style={!isNew?{opacity:0.6,cursor:'not-allowed'}:{}}/></div>
      <div className="form-group"><label>과업명</label><input value={form.title}onChange={e=>setForm(p=>({...p,title:e.target.value}))}/></div>
    </div>
    <div className="form-row">
      <div className="form-group"><label>담당</label><input value={form.assignee||''}onChange={e=>setForm(p=>({...p,assignee:e.target.value}))}/></div>
      <div className="form-group"><label>기한</label><input type="date"value={form.due_date||''}onChange={e=>setForm(p=>({...p,due_date:e.target.value}))}/></div>
    </div>
    <div className="form-row">
      <div className="form-group"><label>우선순위</label><select value={form.priority}onChange={e=>setForm(p=>({...p,priority:e.target.value}))}>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</select></div>
      <div className="form-group"><label>상태</label><select value={form.status}onChange={e=>setForm(p=>({...p,status:e.target.value}))}>{ACTION_STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
    </div>
    <div className="form-group"><label>완료 기준 (Definition of Done)</label><textarea rows={3}value={form.definition_of_done||''}onChange={e=>setForm(p=>({...p,definition_of_done:e.target.value}))}/></div>
    <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
      <button className="btn btn-ghost"onClick={onClose}>취소</button>
      <button className="btn btn-primary"onClick={()=>{if(!form.title.trim()){alert('과업명을 입력하세요.');return;}onUpdate(form);}}>{isNew?'➕ 등록':'💾 저장'}</button>
    </div>
  </div></div>;
}

/* ══════════════════════════════════════════════════
   WORK GROUP BOARD
   ══════════════════════════════════════════════════ */
function WGBoard({docs,onSelectDoc}){
  const[selectedWG,setWG]=useState(null);
  const wgData=useMemo(()=>{
    const m={};WORK_GROUPS.forEach(w=>m[w]={name:w,docs:[],done:0,wip:0,delayed:0,critIssue:0,avgProg:0});
    docs.forEach(d=>(d.work_groups||[]).forEach(w=>{if(m[w]){m[w].docs.push(d);if(['완료','승인완료'].includes(d.status))m[w].done++;else if(d.due_date&&new Date(d.due_date)<new Date()&&!['완료','승인완료'].includes(d.status))m[w].delayed++;else if(!['미착수'].includes(d.status))m[w].wip++;}}));
    Object.values(m).forEach(v=>{v.avgProg=v.docs.length?Math.round(v.docs.reduce((s,d)=>s+d.progress,0)/v.docs.length):0;});
    return Object.values(m).filter(v=>v.docs.length>0);
  },[docs]);

  if(selectedWG){
    const wg=wgData.find(w=>w.name===selectedWG);
    return<div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
        <button className="btn btn-ghost btn-sm"onClick={()=>setWG(null)}>← 목록으로</button>
        <div className="section-title"style={{margin:0}}>👥 {selectedWG} 업무군 ({wg?.docs.length||0}건)</div>
      </div>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>ID</th><th>문서명</th><th>상태</th><th>진행률</th><th>마감일</th><th>담당</th></tr></thead>
        <tbody>{(wg?.docs||[]).map(d=><tr key={d.id}onClick={()=>onSelectDoc(d)}>
          <td style={{fontFamily:'IBM Plex Mono',fontSize:'11px'}}>{d.id}</td>
          <td style={{fontWeight:600}}>{d.doc_name}</td>
          <td><Badge text={d.status}/></td>
          <td><div style={{display:'flex',alignItems:'center',gap:6}}><ProgressBar value={d.progress}/><span style={{fontSize:'10px'}}>{d.progress}%</span></div></td>
          <td><DueTag date={d.due_date}/></td>
          <td style={{fontSize:'11px'}}>{d.primary_owner}</td>
        </tr>)}</tbody>
      </table></div>
    </div>;
  }

  return<div>
    <div className="section-title">👥 업무군별 보드</div>
    <div className="wg-board-grid">{wgData.map(w=><div key={w.name}className="wg-card"onClick={()=>setWG(w.name)}>
      <h4>{w.name}</h4>
      <ProgressBar value={w.avgProg}/>
      <div style={{fontSize:'12px',fontWeight:700,marginTop:4,marginBottom:8}}>{w.avgProg}%</div>
      <div className="wg-stats">
        <span>📄 {w.docs.length}건</span>
        <span>✅ {w.done}건</span>
        <span>🔄 {w.wip}건</span>
        <span style={{color:w.delayed?'var(--red)':'inherit'}}>⚠️ {w.delayed}건 지연</span>
      </div>
    </div>)}</div>
  </div>;
}

/* ══════════════════════════════════════════════════
   MILESTONES
   ══════════════════════════════════════════════════ */
function MilestoneView({milestones}){
  const dotStyle=(s)=>({border:`2px solid ${statusColor(s)}`,color:statusColor(s),background:`${statusColor(s)}15`});
  const icon=(s)=>({Done:'✓',Active:'●',Pending:'○',Overdue:'!'}[s]||'○');
  return<div>
    <div className="section-title">📅 마일스톤</div>
    <div className="ms-track">{milestones.map(m=><div key={m.id}className="ms-item">
      <div className="ms-dot"style={dotStyle(m.status)}>{icon(m.status)}</div>
      <div className="ms-content">
        <div className="ms-date">{m.target_date||'TBD'}</div>
        <div className="ms-name">{m.id}. {m.title}</div>
        <div className="ms-desc">{m.description}</div>
        <div style={{marginTop:6,display:'flex',alignItems:'center',gap:8}}>
          <Badge text={m.status}/>
          <ProgressBar value={m.completion_rate}/>
          <span style={{fontSize:'11px',fontWeight:600}}>{m.completion_rate}%</span>
        </div>
      </div>
    </div>)}</div>
  </div>;
}

/* ══════════════════════════════════════════════════
   COOPERATION REQUESTS
   ══════════════════════════════════════════════════ */
function CoopView({coops,onUpdate}){
  const[showNew,setShowNew]=useState(false);
  const[newCoop,setNewCoop]=useState({title:'',content:'',requester:'',requester_group:'',receiver_group:'',due_date:''});

  return<div>
    <div className="section-title"style={{display:'flex',justifyContent:'space-between'}}>
      <span>🤝 협조 요청</span>
      <button className="btn btn-primary btn-sm"onClick={()=>setShowNew(true)}>+ 새 요청</button>
    </div>
    <div className="tbl-wrap"><table className="tbl">
      <thead><tr><th>제목</th><th>요청자</th><th>요청 그룹</th><th>수신 그룹</th><th>마감일</th><th>상태</th><th>응답</th></tr></thead>
      <tbody>{coops.map(c=><tr key={c.id}>
        <td style={{fontWeight:600}}>{c.title}</td>
        <td style={{fontSize:'11px'}}>{c.requester}</td>
        <td><span className="wg-chip">{c.requester_group}</span></td>
        <td><span className="wg-chip">{c.receiver_group}</span></td>
        <td><DueTag date={c.due_date}/></td>
        <td><select className="btn btn-ghost btn-sm"value={c.status}onChange={e=>onUpdate({...c,status:e.target.value})}>{COOP_STATUSES.map(s=><option key={s}>{s}</option>)}</select></td>
        <td style={{fontSize:'11px',color:'var(--g4)'}}>{c.response||'—'}</td>
      </tr>)}</tbody>
    </table></div>
    {showNew&&<div className="modal-overlay"onClick={()=>setShowNew(false)}><div className="modal"onClick={e=>e.stopPropagation()}>
      <h2>새 협조 요청</h2>
      <div className="form-row"><div className="form-group"><label>제목</label><input value={newCoop.title}onChange={e=>setNewCoop(p=>({...p,title:e.target.value}))}/></div></div>
      <div className="form-row">
        <div className="form-group"><label>요청자</label><input value={newCoop.requester}onChange={e=>setNewCoop(p=>({...p,requester:e.target.value}))}/></div>
        <div className="form-group"><label>요청 그룹</label><select value={newCoop.requester_group}onChange={e=>setNewCoop(p=>({...p,requester_group:e.target.value}))}><option value="">선택</option>{WORK_GROUPS.map(w=><option key={w}>{w}</option>)}</select></div>
        <div className="form-group"><label>수신 그룹</label><select value={newCoop.receiver_group}onChange={e=>setNewCoop(p=>({...p,receiver_group:e.target.value}))}><option value="">선택</option>{WORK_GROUPS.map(w=><option key={w}>{w}</option>)}</select></div>
      </div>
      <div className="form-group"><label>내용</label><textarea value={newCoop.content}onChange={e=>setNewCoop(p=>({...p,content:e.target.value}))}/></div>
      <div className="form-row"><div className="form-group"><label>마감일</label><input type="date"value={newCoop.due_date}onChange={e=>setNewCoop(p=>({...p,due_date:e.target.value}))}/></div></div>
      <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
        <button className="btn btn-ghost"onClick={()=>setShowNew(false)}>취소</button>
        <button className="btn btn-primary"onClick={()=>{if(!newCoop.title.trim()){alert('제목을 입력하세요.');return;}onUpdate({...newCoop,id:Date.now(),status:'요청',response:'',_isNew:true});setShowNew(false);setNewCoop({title:'',content:'',requester:'',requester_group:'',receiver_group:'',due_date:''});}}>등록</button>
      </div>
    </div></div>}
  </div>;
}

/* ══════════════════════════════════════════════════
   MAIN APP
   ══════════════════════════════════════════════════ */
export default function App(){
  const[page,setPage]=useState('dashboard');
  const[docs,setDocs]=useState(SEED_DOCS);
  const[issues,setIssues]=useState(SEED_ISSUES);
  const[risks,setRisks]=useState(SEED_RISKS);
  const[actions,setActions]=useState(SEED_ACTIONS);
  const[milestones,setMilestones]=useState(SEED_MILESTONES);
  const[coops,setCoops]=useState([
    {id:1,title:'완제품시험성적서 수령 일정 확인',content:'외부 시험기관 성적서 수령 예정일 확인 요청',requester:'PM',requester_group:'PMO',receiver_group:'Meditrix',due_date:'2025-05-09',status:'요청',response:''},
    {id:2,title:'제품표준서 미완료 매뉴얼 반영 범위 결정',content:'',requester:'QA',requester_group:'QA',receiver_group:'Executive',due_date:'2025-05-10',status:'요청',response:''},
    {id:3,title:'콘텐츠 관리 권한 체계 정의',content:'',requester:'BlueMit',requester_group:'BlueMit',receiver_group:'Product',due_date:'2025-05-12',status:'요청',response:''},
  ]);
  const[selectedDoc,setSelectedDoc]=useState(null);
  const[connected,setConnected]=useState(false);

  // selectedDoc이 열려있을 때 docs가 업데이트되면 최신 데이터 반영
  useEffect(()=>{
    if(selectedDoc){const updated=docs.find(d=>d.id===selectedDoc.id);if(updated&&updated!==selectedDoc)setSelectedDoc(updated);}
  },[docs]);

  // Supabase 연결 시도
  useEffect(()=>{
    if(!supabase)return;
    (async()=>{
      try{
        const{data,error}=await supabase.from('documents').select('id').limit(1);
        if(!error){
          setConnected(true);
          // 문서 로드
          const{data:dbDocs}=await supabase.from('documents').select('*');
          const{data:wgs}=await supabase.from('document_work_groups').select('*');
          if(dbDocs&&dbDocs.length>0){
            const wgMap={};(wgs||[]).forEach(w=>{if(!wgMap[w.document_id])wgMap[w.document_id]=[];wgMap[w.document_id].push(w.work_group);});
            const{data:fa}=await supabase.from('file_attachments').select('document_id');const fcMap={};(fa||[]).forEach(x=>{fcMap[x.document_id]=(fcMap[x.document_id]||0)+1;});
            setDocs(dbDocs.map(d=>({...d,work_groups:wgMap[d.id]||[],file_count:fcMap[d.id]||0})));
          }else{
            // 시드 데이터 삽입
            for(const d of SEED_DOCS){
              const{work_groups,...docData}=d;
              await supabase.from('documents').upsert(docData);
              if(work_groups)for(const w of work_groups)await supabase.from('document_work_groups').insert({document_id:d.id,work_group:w});
            }
            for(const i of SEED_ISSUES)await supabase.from('issues').upsert(i);
            for(const r of SEED_RISKS)await supabase.from('risks').upsert(r);
            for(const a of SEED_ACTIONS)await supabase.from('action_items').upsert(a);
            for(const m of SEED_MILESTONES)await supabase.from('milestones').upsert(m);
          }
          // 이슈, 리스크, 액션, 마일스톤 로드 (ID 순 정렬)
          const{data:dbIss}=await supabase.from('issues').select('*');if(dbIss?.length)setIssues(sortById(dbIss));
          const{data:dbRisk}=await supabase.from('risks').select('*');if(dbRisk?.length)setRisks(sortById(dbRisk));
          const{data:dbAct}=await supabase.from('action_items').select('*');if(dbAct?.length)setActions(sortById(dbAct));
          const{data:dbMs}=await supabase.from('milestones').select('*');if(dbMs?.length)setMilestones(sortById(dbMs));
          // 협조 요청 로드
          const{data:dbCoop}=await supabase.from('cooperation_requests').select('*');if(dbCoop?.length)setCoops(dbCoop);
        }
      }catch(e){console.log('Supabase not connected, using local data');}
    })();
  },[]);

  // Realtime 구독
  useEffect(()=>{
    if(!supabase||!connected)return;
    const ch=supabase.channel('realtime-all')
      .on('postgres_changes',{event:'*',schema:'public',table:'documents'},()=>loadDocs())
      .on('postgres_changes',{event:'*',schema:'public',table:'issues'},()=>loadIssues())
      .on('postgres_changes',{event:'*',schema:'public',table:'action_items'},()=>loadActions())
      .on('postgres_changes',{event:'*',schema:'public',table:'risks'},()=>loadRisks())
      .on('postgres_changes',{event:'*',schema:'public',table:'milestones'},()=>loadMilestones())
      .on('postgres_changes',{event:'*',schema:'public',table:'cooperation_requests'},()=>loadCoops())
      .on('postgres_changes',{event:'*',schema:'public',table:'file_attachments'},()=>loadDocs())
      .subscribe();
    return()=>ch.unsubscribe();
  },[connected]);

  const loadDocs=async()=>{if(!supabase)return;const{data:d}=await supabase.from('documents').select('*');const{data:w}=await supabase.from('document_work_groups').select('*');const{data:fa}=await supabase.from('file_attachments').select('document_id');if(d){const wm={};(w||[]).forEach(x=>{if(!wm[x.document_id])wm[x.document_id]=[];wm[x.document_id].push(x.work_group);});const fc={};(fa||[]).forEach(x=>{fc[x.document_id]=(fc[x.document_id]||0)+1;});setDocs(sortById(d.map(x=>({...x,work_groups:wm[x.id]||[],file_count:fc[x.id]||0}))));}};
  const loadIssues=async()=>{if(!supabase)return;const{data}=await supabase.from('issues').select('*');if(data)setIssues(sortById(data));};
  const loadActions=async()=>{if(!supabase)return;const{data}=await supabase.from('action_items').select('*');if(data)setActions(sortById(data));};
  const loadRisks=async()=>{if(!supabase)return;const{data}=await supabase.from('risks').select('*');if(data)setRisks(sortById(data));};
  const loadMilestones=async()=>{if(!supabase)return;const{data}=await supabase.from('milestones').select('*');if(data)setMilestones(sortById(data));};
  const loadCoops=async()=>{if(!supabase)return;const{data}=await supabase.from('cooperation_requests').select('*');if(data)setCoops(data);};

  const updateDoc=async(d)=>{
    setDocs(prev=>sortById(prev.map(x=>x.id===d.id?d:x)));
    if(supabase&&connected){
      const{work_groups,...docData}=d;
      await supabase.from('documents').upsert(docData);
      if(work_groups){
        await supabase.from('document_work_groups').delete().eq('document_id',d.id);
        for(const w of work_groups)await supabase.from('document_work_groups').insert({document_id:d.id,work_group:w});
      }
    }
  };

  // ── 이슈 CRUD (삭제 시 ID 재번호) ──
  const updateIssue=async(i)=>{
    setIssues(prev=>sortById(prev.map(x=>x.id===i.id?i:x)));
    if(supabase&&connected)await supabase.from('issues').upsert(i);
  };
  const addIssue=async(i)=>{
    setIssues(prev=>sortById([...prev,i]));
    if(supabase&&connected)await supabase.from('issues').insert(i);
  };
  const deleteIssue=async(id)=>{
    if(supabase&&connected)await supabase.from('issues').delete().eq('id',id);
    const remaining=issues.filter(x=>x.id!==id);
    const renumbered=renumberIds(remaining,'ISSUE-',3);
    // DB에서 ID 변경이 필요한 항목 업데이트 (오름차순으로 처리해 PK 충돌 방지)
    if(supabase&&connected){
      const sorted=sortById(remaining);
      for(let i=0;i<sorted.length;i++){
        const newId=`ISSUE-${String(i+1).padStart(3,'0')}`;
        if(sorted[i].id!==newId)await supabase.from('issues').update({id:newId}).eq('id',sorted[i].id);
      }
    }
    setIssues(renumbered);
  };

  // ── 액션 CRUD (삭제 시 ID 재번호) ──
  const updateAction=async(a)=>{
    setActions(prev=>sortById(prev.map(x=>x.id===a.id?a:x)));
    if(supabase&&connected)await supabase.from('action_items').upsert(a);
  };
  const addAction=async(a)=>{
    setActions(prev=>sortById([...prev,a]));
    if(supabase&&connected)await supabase.from('action_items').insert(a);
  };
  const deleteAction=async(id)=>{
    if(supabase&&connected)await supabase.from('action_items').delete().eq('id',id);
    const remaining=actions.filter(x=>x.id!==id);
    const renumbered=renumberIds(remaining,'A-',2);
    if(supabase&&connected){
      const sorted=sortById(remaining);
      for(let i=0;i<sorted.length;i++){
        const newId=`A-${String(i+1).padStart(2,'0')}`;
        if(sorted[i].id!==newId)await supabase.from('action_items').update({id:newId}).eq('id',sorted[i].id);
      }
    }
    setActions(renumbered);
  };

  // ── 리스크 CRUD (삭제 시 ID 재번호) ──
  const updateRisk=async(r)=>{
    setRisks(prev=>sortById(prev.map(x=>x.id===r.id?r:x)));
    if(supabase&&connected)await supabase.from('risks').upsert(r);
  };
  const addRisk=async(r)=>{
    setRisks(prev=>sortById([...prev,r]));
    if(supabase&&connected)await supabase.from('risks').insert(r);
  };
  const deleteRisk=async(id)=>{
    if(supabase&&connected)await supabase.from('risks').delete().eq('id',id);
    const remaining=risks.filter(x=>x.id!==id);
    const renumbered=renumberIds(remaining,'R-',2);
    if(supabase&&connected){
      const sorted=sortById(remaining);
      for(let i=0;i<sorted.length;i++){
        const newId=`R-${String(i+1).padStart(2,'0')}`;
        if(sorted[i].id!==newId)await supabase.from('risks').update({id:newId}).eq('id',sorted[i].id);
      }
    }
    setRisks(renumbered);
  };

  const updateCoop=async(c)=>{
    if(c._isNew){
      const{_isNew,...rest}=c;
      setCoops(prev=>sortById([...prev,rest]));
      if(supabase&&connected)await supabase.from('cooperation_requests').insert(rest);
    }else{
      setCoops(prev=>sortById(prev.map(x=>x.id===c.id?c:x)));
      if(supabase&&connected)await supabase.from('cooperation_requests').upsert(c);
    }
  };

  const navItems=[
    {id:'dashboard',icon:'📊',label:'대시보드'},
    {id:'documents',icon:'📄',label:'문서 관리'},
    {id:'issues',icon:'⚠️',label:'이슈 관리'},
    {id:'risks',icon:'🛡️',label:'리스크 관리'},
    {id:'actions',icon:'🎯',label:'Action Items'},
    {id:'workgroups',icon:'👥',label:'업무군 보드'},
    {id:'milestones',icon:'📅',label:'마일스톤'},
    {id:'cooperation',icon:'🤝',label:'협조 요청'},
  ];

  return<>
    <style>{CSS}</style>
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-logo">SaMD GMP PMS<span>Document Management System</span></div>
        <div className="nav-section">메뉴</div>
        {navItems.map(n=><div key={n.id}className={`nav-item ${page===n.id?'active':''}`}onClick={()=>setPage(n.id)}>{n.icon} {n.label}</div>)}
        <div style={{flex:1}}/>
        <div style={{padding:'12px 16px',borderTop:'1px solid var(--brd)'}}>
          <div className="conn-status">
            <div className="conn-dot"style={{background:connected?'var(--grn)':'var(--yel)'}}/>
            <span style={{fontSize:'10.5px',color:'var(--g4)'}}>{connected?'Supabase 연결됨':'로컬 모드'}</span>
          </div>
          <div style={{fontSize:'10px',color:'var(--g6)',marginTop:4}}>문서 {docs.length}종 · 이슈 {issues.length}건</div>
        </div>
      </div>
      <div className="main">
        <div className="header">
          <h1>SaMD <em>GMP 인증</em> 문서관리</h1>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:'11px',color:'var(--g4)'}}>BlueMit DTx · QMS-RPT-2025-001</span>
            <Badge text={`진행률 ~${docs.length?Math.round(docs.reduce((s,d)=>s+d.progress,0)/docs.length):0}%`}color="var(--cyan)"/>
          </div>
        </div>
        <div className="content">
          {page==='dashboard'&&<Dashboard docs={docs}issues={issues}risks={risks}actions={actions}milestones={milestones}/>}
          {page==='documents'&&<DocList docs={docs}onSelect={setSelectedDoc}/>}
          {page==='issues'&&<IssueList issues={issues}onUpdate={updateIssue}onAdd={addIssue}onDelete={deleteIssue}/>}
          {page==='risks'&&<RiskList risks={risks}onUpdate={updateRisk}onAdd={addRisk}onDelete={deleteRisk}/>}
          {page==='actions'&&<ActionList actions={actions}onUpdate={updateAction}onAdd={addAction}onDelete={deleteAction}/>}
          {page==='workgroups'&&<WGBoard docs={docs}onSelectDoc={setSelectedDoc}/>}
          {page==='milestones'&&<MilestoneView milestones={milestones}/>}
          {page==='cooperation'&&<CoopView coops={coops}onUpdate={updateCoop}/>}
        </div>
      </div>
    </div>
    {selectedDoc&&<DocDetail doc={selectedDoc}onClose={()=>setSelectedDoc(null)}onUpdate={updateDoc}connected={connected}/>}
  </>;
}
