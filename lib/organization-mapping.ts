/**
 * 조직명 매핑 테이블
 *
 * 삼성바이오로직스의 조직명을 일반 제조업체 용어로 변환
 * View Layer에서만 적용되며, 데이터베이스는 변경하지 않음
 *
 * 사용법:
 * import { mapOrganizationName, enableOrgMapping, disableOrgMapping } from '@/lib/organization-mapping'
 *
 * const displayName = mapOrganizationName(dbOrgName)
 */

// 매핑 활성화 플래그 (필요시 false로 설정하여 원본 이름 표시)
let orgMappingEnabled = true;

/**
 * 조직명 매핑 테이블
 * key: 원본 조직명 (DB에 저장된 이름)
 * value: 표시할 조직명 (사용자에게 보여질 이름)
 */
const ORG_NAME_MAPPING: Record<string, string> = {
  // ===== 센터 레벨 (본부급) =====
  "영업센터": "영업본부",
  "오퍼레이션센터": "생산운영본부",
  "EPCV센터": "생산기술본부",
  "품질운영센터": "품질관리본부",
  "CDO개발센터": "기술개발본부",
  "바이오연구소": "중앙연구소",
  "경영지원센터": "경영지원본부",
  "People센터": "인사본부",
  "상생협력센터": "협력사업본부",

  // 유지되는 센터
  "경영진단팀": "경영진단팀",
  "대표이사": "대표이사",
  "이사회": "이사회",
  "자문역/고문": "자문역/고문",

  // ===== 담당 레벨 =====
  "MSAT담당": "생산기술담당",
  "QA담당": "품질보증담당",
  "QC담당": "품질관리담당",
  "DP담당": "완제품담당",
  "DS담당": "원료담당",
  "E&F담당": "설비기술담당",
  "Operational Excellence담당": "운영혁신담당",
  "Sales&Operation담당": "영업운영담당",
  "영업지원담당": "영업지원담당",
  "인사지원담당": "인사지원담당",

  // ===== 팀 레벨 (바이오 특화 → 일반 제조) =====
  // 개발/기술 팀
  "ADC개발팀": "공정개발팀",
  "항체배양PD팀": "생산기술1팀",
  "항체정제PD팀": "생산기술2팀",
  "CMC Support팀": "기술지원팀",
  "CDO SE팀": "기술영업팀",
  "CDO Sales팀": "기술영업팀",
  "CMO SE팀": "생산영업�team",
  "CMO Sales팀": "생산영업팀",
  "MSAT 1팀": "생산기술1팀",
  "MSAT 2팀": "생산기술2팀",
  "MSAT PD팀": "공정기술팀",
  "MSAT Technical Excellence팀": "기술혁신팀",

  // 생산 팀 (Plant → 공장)
  "Plant 1팀": "제1공장",
  "Plant 2팀": "제2공장",
  "Plant 3팀": "제3공장",
  "Plant 4A팀": "제4-A공장",
  "Plant 4B팀": "제4-B공장",
  "Plant 5팀": "제5공장",
  "무균충전팀": "충전포장팀",

  // 품질 팀
  "Client Quality팀": "고객품질팀",
  "Compliance QA팀": "법규준수팀",
  "DP Compliance팀": "완제품법규팀",
  "Operation QA팀": "운영품질팀",
  "Technical QA팀": "기술품질팀",
  "QC Operations팀": "품질검사운영팀",
  "QC Support팀": "품질검사지원팀",
  "Validation팀": "밸리데이션팀",

  // 설비 팀
  "Facility Operation팀": "설비운영팀",
  "Facility Technology팀": "설비기술팀",
  "Corporate Engineering팀": "종합설비관리팀",

  // 기획/지원 팀
  "사업전략팀": "사업전략팀",
  "오퍼레이션기획팀": "생산기획팀",
  "오퍼레이션혁신팀": "생산혁신팀",
  "EPM팀": "프로젝트관리팀",
  "PM팀": "프로젝트관리팀",
  "IT팀": "정보기술팀",
  "MES팀": "생산정보팀",

  // 영업/마케팅 팀
  "Market Intelligence팀": "시장분석팀",
  "마케팅팀": "마케팅팀",
  "Sales&Operation팀": "영업운영팀",
  "Global PA팀": "글로벌영업팀",

  // 인사 팀
  "People Experience팀": "인사관리팀",
  "Talent Acquisition팀": "채용팀",
  "Talent Management팀": "인재개발팀",
  "Learning·Development팀": "교육개발팀",

  // 경영지원 팀
  "재경팀": "재경팀",
  "IR팀": "투자관리팀",
  "구매팀": "구매팀",
  "대외협력팀": "대외협력팀",
  "커뮤니케이션팀": "커뮤니케이션팀",
  "준법경영팀": "준법경영팀",
  "정보보호팀": "정보보호팀",
  "지속가능경영팀": "지속가능경영팀",
  "안전환경팀": "안전환경팀",
  "인프라복지팀": "복지후생팀",

  // ===== 그룹 레벨 =====
  // ADC 관련 (항체약물결합체 → 공정)
  "ADC공정개발그룹": "공정개발그룹",
  "ADC분석개발그룹": "분석개발그룹",
  "ADC/mRNA제조그룹": "신제품제조그룹",
  "ADC/mRNA운영팀": "신제품운영팀",

  // 바이오 특화 기술 → 일반 기술
  "AAV기술그룹": "바이러스기술그룹",
  "DNA기술그룹": "유전자기술그룹",
  "mRNA기술그룹": "RNA기술그룹",
  "GT기술Lab": "유전자Lab",
  "항체기술Lab": "단백질Lab",
  "항체기술개발그룹": "단백질개발그룹",
  "항체기술응용그룹": "단백질응용그룹",
  "선행공정개발Lab": "선행공정Lab",

  // 생산 그룹 (배양/정제 → 생산1/생산2)
  "Plant 1 배양그룹": "제1공장 생산1그룹",
  "Plant 1 정제그룹": "제1공장 생산2그룹",
  "Plant 2 배양그룹": "제2공장 생산1그룹",
  "Plant 2 정제그룹": "제2공장 생산2그룹",
  "Plant 3 배양그룹": "제3공장 생산1그룹",
  "Plant 3 정제그룹": "제3공장 생산2그룹",
  "Plant 4A 배양그룹": "제4-A공장 생산1그룹",
  "Plant 4A 정제그룹": "제4-A공장 생산2그룹",
  "Plant 4B 배양그룹": "제4-B공장 생산1그룹",
  "Plant 4B 정제그룹": "제4-B공장 생산2그룹",
  "Plant 5 배양그룹": "제5공장 생산1그룹",
  "Plant 5 정제그룹": "제5공장 생산2그룹",
  "sP배양그룹": "Pilot 생산1그룹",
  "sP정제그룹": "Pilot 생산2그룹",
  "Pilot Manufacturing그룹": "Pilot생산그룹",

  // 충전/포장
  "무균충전1그룹": "충전1그룹",
  "무균충전2그룹": "충전2그룹",
  "VI·PKG그룹": "포장그룹",
  "이물검사·패키징팀": "검사포장팀",

  // 공정개발 (배양/정제 → 생산공정)
  "배양공정개발그룹": "생산공정개발1그룹",
  "정제공정개발그룹": "생산공정개발2그룹",
  "PD USP그룹": "원료공정그룹",
  "PD DSP그룹": "정제공정그룹",
  "CM개발그룹": "배지개발그룹",

  // 세포/분자 (바이오 특화 → 생물공학)
  "세포주개발그룹": "세포공학그룹",
  "분자세포엔지니어링그룹": "세포엔지니어링그룹",

  // 분석/품질
  "분석개발그룹": "분석개발그룹",
  "분석기술지원그룹": "분석지원그룹",
  "시험법기술이전그룹": "시험법이전그룹",
  "제형개발그룹": "제형개발그룹",
  "이화학그룹": "이화학그룹",
  "생화학그룹": "생화학그룹",
  "미생물그룹": "미생물그룹",

  // MSAT (Manufacturing Science and Technology)
  "P1/2 MSAT그룹": "1-2공장 기술그룹",
  "P3 MSAT그룹": "3공장 기술그룹",
  "P4 MSAT그룹": "4공장 기술그룹",
  "P5 MSAT그룹": "5공장 기술그룹",
  "MSAT Compliance그룹": "생산기술법규그룹",
  "MSAT Digitalization그룹": "생산기술디지털그룹",
  "MSAT Planning그룹": "생산기술기획그룹",

  // 품질보증 (QA)
  "Analytical QA그룹": "분석품질보증그룹",
  "Development QA그룹": "개발품질보증그룹",
  "MFG QA 1그룹": "생산품질보증1그룹",
  "MFG QA 2그룹": "생산품질보증2그룹",
  "MFG Investigation QA그룹": "품질조사그룹",
  "Client Quality 1그룹": "고객품질1그룹",
  "Client Quality 2그룹": "고객품질2그룹",
  "Client Quality 3그룹": "고객품질3그룹",
  "Process Control QA그룹": "공정품질관리그룹",
  "Plant Compliance그룹": "공장법규준수그룹",

  // 품질관리 (QC)
  "IPC그룹": "공정검사그룹",
  "Material QA그룹": "자재품질그룹",
  "QC Compliance그룹": "품질검사법규그룹",
  "QC Performance관리그룹": "검사성능관리그룹",
  "QC샘플관리그룹": "샘플관리그룹",
  "QC장비관리그룹": "검사장비관리그룹",
  "Non-Routine시험그룹": "비정기시험그룹",

  // 품질시스템
  "Quality Management그룹": "품질경영그룹",
  "Quality Improvement그룹": "품질개선그룹",
  "Quality PMO그룹": "품질관리그룹",
  "QES그룹": "품질시스템그룹",
  "Validation Oversight그룹": "밸리데이션관리그룹",
  "NPI Oversight그룹": "신제품품질그룹",
  "Audit & Inspection그룹": "감사점검그룹",

  // Compliance (법규준수)
  "Compliance그룹": "법규준수그룹",
  "DP Compliance그룹": "완제품법규그룹",
  "DS Compliance그룹": "원료법규그룹",
  "Regulatory Affairs그룹": "인허가그룹",

  // 기술지원
  "DP Tech Support그룹": "완제품기술지원그룹",
  "DP Tech Transfer그룹": "완제품기술이전그룹",
  "Bio R&D지원그룹": "R&D지원그룹",
  "CDO SE그룹": "기술영업그룹",
  "CMO SE1그룹": "생산영업1그룹",
  "CMO SE2그룹": "생산영업2그룹",
  "ASAT팀": "분석지원팀",

  // 설비/시설
  "Facility Monitoring그룹": "설비감시그룹",
  "Facility Reliability그룹": "설비신뢰성그룹",
  "Facility&Utility Engineering그룹": "설비유틸리티그룹",
  "UT운영그룹": "유틸리티운영그룹",
  "UT보전그룹": "유틸리티보전그룹",
  "계측설비그룹": "계측설비그룹",
  "공정설비그룹": "공정설비그룹",
  "설비기술연구그룹": "설비기술그룹",
  "Process Engineering그룹": "공정엔지니어링그룹",

  // IT/디지털
  "Automation그룹": "자동화그룹",
  "CSV그룹": "시스템밸리데이션그룹",
  "MES그룹": "생산정보그룹",
  "Operational Technology그룹": "운영기술그룹",
  "Digital Excellence그룹": "디지털혁신그룹",
  "DI Governance그룹": "데이터거버넌스그룹",
  "Master Data Management그룹": "마스터데이터그룹",
  "정보전략그룹": "정보전략그룹",
  "AI Lab": "AI Lab",
  "AI&I그룹": "AI혁신그룹",

  // 생산운영
  "Production Planning그룹": "생산계획그룹",
  "Operational Excellence그룹": "운영혁신그룹",
  "OES혁신그룹": "운영혁신그룹",
  "오퍼레이션지원그룹": "생산지원그룹",
  "운영그룹": "운영그룹",
  "DS System Readiness그룹": "시스템준비그룹",
  "Batch Disposition그룹": "배치처분그룹",

  // 물류/자재
  "물류그룹": "물류그룹",
  "RM그룹": "원자재그룹",
  "원자재그룹": "원자재그룹",

  // 구매
  "구매전략그룹": "구매전략그룹",
  "설비구매그룹": "설비구매그룹",
  "자재구매그룹": "자재구매그룹",
  "외주구매그룹": "외주구매그룹",

  // 영업/마케팅
  "APAC Sales그룹": "아시아영업그룹",
  "Sales Operation그룹": "영업운영그룹",
  "NJ Sales Office": "해외영업그룹",
  "사업개발그룹": "사업개발그룹",
  "마케팅전략파트": "마케팅전략파트",
  "브랜드마케팅그룹": "브랜드마케팅그룹",
  "미디어마케팅그룹": "미디어마케팅그룹",
  "미디어커뮤니케이션그룹": "미디어커뮤니케이션그룹",
  "뉴미디어그룹": "뉴미디어그룹",

  // HR (인사)
  "HR Strategy그룹": "인사전략그룹",
  "경력채용그룹": "경력채용그룹",
  "신입채용그룹": "신입채용그룹",
  "인력운영그룹": "인력운영그룹",
  "제도보상그룹": "제도보상그룹",
  "조직문화그룹": "조직문화그룹",
  "노사협력그룹": "노사협력그룹",
  "Leadership개발그룹": "리더십개발그룹",
  "인프라복지그룹": "복지후생그룹",

  // 경영관리
  "기획그룹": "기획그룹",
  "재무그룹": "재무그룹",
  "투자기획그룹": "투자기획그룹",
  "세무그룹": "세무그룹",
  "내부회계운영그룹": "내부회계그룹",
  "PJT정산관리그룹": "프로젝트정산그룹",
  "진단그룹": "경영진단그룹",

  // 법무/준법
  "국내법무그룹": "국내법무그룹",
  "해외법무그룹": "해외법무그룹",
  "준법그룹": "준법그룹",
  "Contract그룹": "계약그룹",

  // SHE (안전보건환경)
  "안전그룹": "안전그룹",
  "환경그룹": "환경그룹",
  "건설안전그룹": "건설안전그룹",
  "ESG그룹": "ESG그룹",
  "SHE전략파트": "안전환경전략파트",

  // 기타
  "CDO지원그룹": "기술개발지원그룹",
  "경영지원그룹": "경영지원그룹",
  "SBA Support그룹": "중소기업지원그룹",
  "Open Innovation그룹": "개방형혁신그룹",
  "New Modality그룹": "신기술그룹",
  "기술교육그룹": "기술교육그룹",

  // PMO/프로젝트
  "PMO그룹": "프로젝트관리그룹",
  "PM1그룹": "프로젝트1그룹",
  "PM2그룹": "프로젝트2그룹",
  "PM3그룹": "프로젝트3그룹",
  "PM4그룹": "프로젝트4그룹",
  "PM Biz Excellence파트": "프로젝트혁신파트",
  "EBS그룹": "프로젝트시스템그룹",
  "BPM그룹": "프로세스관리그룹",
  "Global PA파트": "글로벌영업파트",

  // Task Force (T/F) - 일시적 조직
  "ADC T/F": "공정혁신TF",
  "DI 개선 T/F": "데이터개선TF",
  "DP PFS 수행 T/F": "완제품TF",
  "MSAT PMO T/F": "생산기술PMO_TF",
  "P5 T/F": "5공장TF",
  "P6 T/F": "6공장TF",
  "신사업추진 T/F": "신사업TF",
  "펩타이드 T/F": "펩타이드TF",
};

/**
 * 조직명을 매핑된 이름으로 변환
 * @param orgName 원본 조직명
 * @returns 매핑된 조직명 (매핑이 없으면 원본 반환)
 */
export function mapOrganizationName(orgName: string | null | undefined): string {
  if (!orgName) return "";
  if (!orgMappingEnabled) return orgName;
  return ORG_NAME_MAPPING[orgName] || orgName;
}

/**
 * 조직명 매핑 활성화
 */
export function enableOrgMapping(): void {
  orgMappingEnabled = true;
}

/**
 * 조직명 매핑 비활성화 (원본 이름 표시)
 */
export function disableOrgMapping(): void {
  orgMappingEnabled = false;
}

/**
 * 현재 매핑 활성화 상태 확인
 */
export function isOrgMappingEnabled(): boolean {
  return orgMappingEnabled;
}

/**
 * 매핑 테이블 전체 조회 (디버깅용)
 */
export function getOrgMappingTable(): Record<string, string> {
  return { ...ORG_NAME_MAPPING };
}

/**
 * 역방향 매핑: 표시명 → 원본명
 * (검색 등에 필요할 경우 사용)
 */
export function reverseMapOrganizationName(displayName: string): string {
  if (!orgMappingEnabled) return displayName;

  const reverseMap = Object.entries(ORG_NAME_MAPPING).find(
    ([_, mapped]) => mapped === displayName
  );

  return reverseMap ? reverseMap[0] : displayName;
}
