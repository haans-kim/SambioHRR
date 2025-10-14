"""
Data type definitions matching DATA_TABLES_COMPLETE_MAPPING.md
"""
from enum import Enum
from typing import Dict, List
from pydantic import BaseModel


class DataTypePriority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class DataTypeInfo(BaseModel):
    id: str
    label: str
    description: str
    priority: DataTypePriority
    table_name: str
    file_pattern: str
    sample_columns: List[str]
    date_column: str | None = None
    employee_column: str | None = None


# Complete mapping of all 12 data types
DATA_TYPES: Dict[str, DataTypeInfo] = {
    "tag_data": DataTypeInfo(
        id="tag_data",
        label="Tagging Data (출입 태그)",
        description="필수 - RFID 출입 태그 데이터",
        priority=DataTypePriority.CRITICAL,
        table_name="tag_data",
        file_pattern="입출문기록*.xlsx",
        sample_columns=["일자", "사번", "출입시각", "DR_GB"],
        date_column="ENTE_DT",
        employee_column="사번"
    ),
    "claim_data": DataTypeInfo(
        id="claim_data",
        label="Claim Data (근태 신고)",
        description="필수 - 근무시간 신고 데이터",
        priority=DataTypePriority.CRITICAL,
        table_name="claim_data",
        file_pattern="claim_data*.xlsx",
        sample_columns=["일자", "사번", "근무시간"],
        date_column="근무일",
        employee_column="사번"
    ),
    "employees": DataTypeInfo(
        id="employees",
        label="Employee Data (조직/직원 정보)",
        description="필수 - 조직 구조 및 직원 마스터 데이터",
        priority=DataTypePriority.CRITICAL,
        table_name="organization_data",
        file_pattern="*Organization*.xlsx",
        sample_columns=["사번", "이름", "센터", "팀"],
        date_column=None,
        employee_column="사번"
    ),
    "meal_data": DataTypeInfo(
        id="meal_data",
        label="Meal Data (식사 데이터)",
        description="식사 태그 데이터 (M1/M2 판정)",
        priority=DataTypePriority.HIGH,
        table_name="meal_data",
        file_pattern="Meal_*.xlsx",
        sample_columns=["취식일시", "사번", "테이크아웃"],
        date_column="취식일시",
        employee_column="사번"
    ),
    "knox_approval": DataTypeInfo(
        id="knox_approval",
        label="Knox Approval (전자결재)",
        description="Knox 전자결재 시스템 로그 → O 태그",
        priority=DataTypePriority.HIGH,
        table_name="knox_approval_data",
        file_pattern="Knox_approval*.xlsx",
        sample_columns=["기안일", "기안자ID", "결재구분"],
        date_column="Timestamp",
        employee_column="UserNo"
    ),
    "knox_mail": DataTypeInfo(
        id="knox_mail",
        label="Knox Mail (메일)",
        description="Knox 메일 시스템 로그 → O 태그",
        priority=DataTypePriority.HIGH,
        table_name="knox_mail_data",
        file_pattern="Knox_mail*.xlsx",
        sample_columns=["발송일시", "발송자ID"],
        date_column="발신일시_GMT9",
        employee_column="발신인사번_text"
    ),
    "knox_pims": DataTypeInfo(
        id="knox_pims",
        label="Knox PIMS (회의실 예약)",
        description="Knox PIMS 회의 데이터 → O 태그",
        priority=DataTypePriority.HIGH,
        table_name="knox_pims_data",
        file_pattern="Knox_PIMS*.xlsx",
        sample_columns=["회의일자", "예약자ID"],
        date_column="start_time",
        employee_column="employee_id"
    ),
    "eam_data": DataTypeInfo(
        id="eam_data",
        label="EAM (안전설비시스템)",
        description="EAM 설비 시스템 로그인 이력 → O 태그",
        priority=DataTypePriority.MEDIUM,
        table_name="eam_data",
        file_pattern="EAM_*.xlsx",
        sample_columns=["로그인일시", "사번"],
        date_column="ATTEMPTDATE",
        employee_column="USERNO"
    ),
    "equis_data": DataTypeInfo(
        id="equis_data",
        label="Equis (장비관리)",
        description="Equis 장비 사용 이력 → O 태그",
        priority=DataTypePriority.MEDIUM,
        table_name="equis_data",
        file_pattern="EQUIS_*.xlsx",
        sample_columns=["사용시작일시", "사번"],
        date_column="Timestamp",
        employee_column="USERNO( ID->사번매칭 )"
    ),
    "lams_data": DataTypeInfo(
        id="lams_data",
        label="LAMS (실험실관리)",
        description="LAMS 품질시스템 스케줄 작성 이력 → O 태그",
        priority=DataTypePriority.LOW,
        table_name="lams_data",
        file_pattern="LAMS_*.xlsx",
        sample_columns=["작성일시", "사번"],
        date_column="DATE",
        employee_column="User_No"
    ),
    "mes_data": DataTypeInfo(
        id="mes_data",
        label="MES (생산시스템)",
        description="MES 생산관리 시스템 로그인 이력 → O 태그",
        priority=DataTypePriority.LOW,
        table_name="mes_data",
        file_pattern="MES_*.xlsx",
        sample_columns=["로그인일시", "사번"],
        date_column="login_time",
        employee_column="USERNo"
    ),
    "mdm_data": DataTypeInfo(
        id="mdm_data",
        label="MDM (마스터데이터)",
        description="MDM 데이터 관리 시스템 이력 → O 태그",
        priority=DataTypePriority.LOW,
        table_name="mdm_data",
        file_pattern="MDM_*.xlsx",
        sample_columns=["처리일시", "사번"],
        date_column="Timestap",
        employee_column="UserNo"
    ),
}


class UploadStatus(BaseModel):
    """Upload progress status"""
    file_name: str
    data_type: str
    total_rows: int
    processed_rows: int
    progress: float
    status: str  # 'processing', 'completed', 'error'
    message: str | None = None
    error: str | None = None


class DataStats(BaseModel):
    """Database statistics for a data type"""
    data_type: str
    table_name: str
    row_count: int
    date_range: Dict[str, str] | None = None
    last_updated: str | None = None
