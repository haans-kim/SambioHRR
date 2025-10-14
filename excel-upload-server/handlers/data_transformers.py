"""
Data transformation handlers for each data type
Based on DATA_TABLES_COMPLETE_MAPPING.md specifications
"""
import pandas as pd
from datetime import datetime
import logging
from typing import Callable, Dict

logger = logging.getLogger(__name__)


class DataTransformers:
    """Collection of data transformation functions for each data type"""

    @staticmethod
    def transform_tag_data(df: pd.DataFrame) -> pd.DataFrame:
        """
        Transform tag_data Excel to DB format
        Mapping: 일자→ENTE_DT, 사번→사번, DR_GB→DR_GB, etc.
        """
        logger.info("Transforming tag_data...")

        # Column mapping
        column_map = {
            '일자': 'ENTE_DT',
            '요일구분': 'DAY_GB',
            '요일명': 'DAY_NM',
            '이름': 'NAME',
            '사번': '사번',
            '센터': 'CENTER',
            '담당': 'BU',
            '팀': 'TEAM',
            '그룹': 'GROUP_A',
            '파트': 'PART',
            '출입시각': '출입시각',
            '문번호': 'DR_NO',
            '문명칭': 'DR_NM',
            'DR구분': 'DR_GB',
            '출입구분': 'INOUT_GB'
        }

        # Rename columns
        df = df.rename(columns=column_map)

        # Data type conversions
        if 'ENTE_DT' in df.columns:
            df['ENTE_DT'] = df['ENTE_DT'].astype(str).str.replace('-', '')
            df['ENTE_DT'] = pd.to_numeric(df['ENTE_DT'], errors='coerce')

        if '사번' in df.columns:
            df['사번'] = pd.to_numeric(df['사번'], errors='coerce')

        if '출입시각' in df.columns:
            # Convert timestamp to integer format (YYYYMMDDHHmmss)
            df['출입시각'] = pd.to_datetime(df['출입시각'], errors='coerce')
            df['출입시각'] = df['출입시각'].apply(
                lambda x: int(x.strftime('%Y%m%d%H%M%S')) if pd.notna(x) else None
            )

        logger.info(f"tag_data transformation complete: {len(df):,} rows")
        return df

    @staticmethod
    def transform_claim_data(df: pd.DataFrame) -> pd.DataFrame:
        """Transform claim_data Excel to DB format"""
        logger.info("Transforming claim_data...")

        column_map = {
            '일자': '일자',
            '사번': '사번',
            '이름': '이름',
            '센터': '센터',
            '담당': '담당',
            '팀': '팀',
            '그룹': '그룹',
            '근무시간': '근무시간',
            '근무구분': '근무구분'
        }

        df = df.rename(columns=column_map)

        # Convert date format
        if '일자' in df.columns:
            df['일자'] = df['일자'].astype(str).str.replace('-', '')
            df['일자'] = pd.to_numeric(df['일자'], errors='coerce')

        if '사번' in df.columns:
            df['사번'] = pd.to_numeric(df['사번'], errors='coerce')

        if '근무시간' in df.columns:
            df['근무시간'] = pd.to_numeric(df['근무시간'], errors='coerce')

        logger.info(f"claim_data transformation complete: {len(df):,} rows")
        return df

    @staticmethod
    def transform_organization_data(df: pd.DataFrame) -> pd.DataFrame:
        """Transform organization/employee data Excel to DB format"""
        logger.info("Transforming organization_data...")

        column_map = {
            '사번': '사번',
            '이름': '이름',
            '소속': '소속',
            '센터': '센터',
            '담당': '담당',
            '팀': '팀',
            '그룹': '그룹',
            '직급': '직급',
            '직책': '직책',
            '재직상태': '재직상태'
        }

        df = df.rename(columns=column_map)

        if '사번' in df.columns:
            df['사번'] = pd.to_numeric(df['사번'], errors='coerce')

        logger.info(f"organization_data transformation complete: {len(df):,} rows")
        return df

    @staticmethod
    def transform_meal_data(df: pd.DataFrame) -> pd.DataFrame:
        """Transform meal_data Excel to DB format"""
        logger.info("Transforming meal_data...")

        column_map = {
            '취식일시': '취식일시',
            '사번': '사번',
            '이름': '이름',
            '식사구분': '식사구분',
            '배식구': '배식구',
            '테이크아웃': '테이크아웃'
        }

        df = df.rename(columns=column_map)

        # Convert timestamp
        if '취식일시' in df.columns:
            df['취식일시'] = pd.to_datetime(df['취식일시'], errors='coerce')
            df['취식일시'] = df['취식일시'].apply(
                lambda x: int(x.strftime('%Y%m%d%H%M%S')) if pd.notna(x) else None
            )

        if '사번' in df.columns:
            df['사번'] = pd.to_numeric(df['사번'], errors='coerce')

        logger.info(f"meal_data transformation complete: {len(df):,} rows")
        return df

    @staticmethod
    def transform_knox_approval_data(df: pd.DataFrame) -> pd.DataFrame:
        """Transform Knox approval data Excel to DB format"""
        logger.info("Transforming knox_approval_data...")

        column_map = {
            '기안일': '기안일',
            '기안자ID': '기안자ID',
            '기안자명': '기안자명',
            '결재구분': '결재구분',
            '문서번호': '문서번호',
            '제목': '제목'
        }

        df = df.rename(columns=column_map)

        # Convert date
        if '기안일' in df.columns:
            df['기안일'] = pd.to_datetime(df['기안일'], errors='coerce')
            df['기안일'] = df['기안일'].apply(
                lambda x: int(x.strftime('%Y%m%d%H%M%S')) if pd.notna(x) else None
            )

        logger.info(f"knox_approval_data transformation complete: {len(df):,} rows")
        return df

    @staticmethod
    def transform_knox_mail_data(df: pd.DataFrame) -> pd.DataFrame:
        """Transform Knox mail data Excel to DB format"""
        logger.info("Transforming knox_mail_data...")

        column_map = {
            '발송일시': '발송일시',
            '발송자ID': '발송자ID',
            '발송자명': '발송자명',
            '수신자': '수신자',
            '제목': '제목'
        }

        df = df.rename(columns=column_map)

        if '발송일시' in df.columns:
            df['발송일시'] = pd.to_datetime(df['발송일시'], errors='coerce')
            df['발송일시'] = df['발송일시'].apply(
                lambda x: int(x.strftime('%Y%m%d%H%M%S')) if pd.notna(x) else None
            )

        logger.info(f"knox_mail_data transformation complete: {len(df):,} rows")
        return df

    @staticmethod
    def transform_knox_pims_data(df: pd.DataFrame) -> pd.DataFrame:
        """Transform Knox PIMS data Excel to DB format"""
        logger.info("Transforming knox_pims_data...")

        column_map = {
            '회의일자': '회의일자',
            '예약자ID': '예약자ID',
            '예약자명': '예약자명',
            '회의실': '회의실',
            '회의제목': '회의제목'
        }

        df = df.rename(columns=column_map)

        if '회의일자' in df.columns:
            df['회의일자'] = pd.to_datetime(df['회의일자'], errors='coerce')
            df['회의일자'] = df['회의일자'].apply(
                lambda x: int(x.strftime('%Y%m%d')) if pd.notna(x) else None
            )

        logger.info(f"knox_pims_data transformation complete: {len(df):,} rows")
        return df

    @staticmethod
    def transform_eam_data(df: pd.DataFrame) -> pd.DataFrame:
        """Transform EAM data Excel to DB format"""
        logger.info("Transforming eam_data...")

        column_map = {
            '로그인일시': '로그인일시',
            '사번': '사번',
            '이름': '이름',
            '시스템': '시스템',
            '기능': '기능'
        }

        df = df.rename(columns=column_map)

        if '로그인일시' in df.columns:
            df['로그인일시'] = pd.to_datetime(df['로그인일시'], errors='coerce')
            df['로그인일시'] = df['로그인일시'].apply(
                lambda x: int(x.strftime('%Y%m%d%H%M%S')) if pd.notna(x) else None
            )

        if '사번' in df.columns:
            df['사번'] = pd.to_numeric(df['사번'], errors='coerce')

        logger.info(f"eam_data transformation complete: {len(df):,} rows")
        return df

    @staticmethod
    def transform_equis_data(df: pd.DataFrame) -> pd.DataFrame:
        """Transform Equis data Excel to DB format"""
        logger.info("Transforming equis_data...")

        column_map = {
            '사용시작일시': '사용시작일시',
            '사용종료일시': '사용종료일시',
            '사번': '사번',
            '이름': '이름',
            '장비명': '장비명',
            '장비코드': '장비코드'
        }

        df = df.rename(columns=column_map)

        # Convert timestamps
        for col in ['사용시작일시', '사용종료일시']:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors='coerce')
                df[col] = df[col].apply(
                    lambda x: int(x.strftime('%Y%m%d%H%M%S')) if pd.notna(x) else None
                )

        if '사번' in df.columns:
            df['사번'] = pd.to_numeric(df['사번'], errors='coerce')

        logger.info(f"equis_data transformation complete: {len(df):,} rows")
        return df

    @staticmethod
    def transform_lams_data(df: pd.DataFrame) -> pd.DataFrame:
        """Transform LAMS data Excel to DB format"""
        logger.info("Transforming lams_data...")

        column_map = {
            '작성일시': '작성일시',
            '사번': '사번',
            '이름': '이름',
            '작업유형': '작업유형',
            '스케줄ID': '스케줄ID'
        }

        df = df.rename(columns=column_map)

        if '작성일시' in df.columns:
            df['작성일시'] = pd.to_datetime(df['작성일시'], errors='coerce')
            df['작성일시'] = df['작성일시'].apply(
                lambda x: int(x.strftime('%Y%m%d%H%M%S')) if pd.notna(x) else None
            )

        if '사번' in df.columns:
            df['사번'] = pd.to_numeric(df['사번'], errors='coerce')

        logger.info(f"lams_data transformation complete: {len(df):,} rows")
        return df

    @staticmethod
    def transform_mes_data(df: pd.DataFrame) -> pd.DataFrame:
        """Transform MES data Excel to DB format"""
        logger.info("Transforming mes_data...")

        column_map = {
            '로그인일시': '로그인일시',
            '사번': '사번',
            '이름': '이름',
            '라인': '라인',
            '공정': '공정'
        }

        df = df.rename(columns=column_map)

        if '로그인일시' in df.columns:
            df['로그인일시'] = pd.to_datetime(df['로그인일시'], errors='coerce')
            df['로그인일시'] = df['로그인일시'].apply(
                lambda x: int(x.strftime('%Y%m%d%H%M%S')) if pd.notna(x) else None
            )

        if '사번' in df.columns:
            df['사번'] = pd.to_numeric(df['사번'], errors='coerce')

        logger.info(f"mes_data transformation complete: {len(df):,} rows")
        return df

    @staticmethod
    def transform_mdm_data(df: pd.DataFrame) -> pd.DataFrame:
        """Transform MDM data Excel to DB format"""
        logger.info("Transforming mdm_data...")

        column_map = {
            '처리일시': '처리일시',
            '사번': '사번',
            '이름': '이름',
            '처리구분': '처리구분',
            '데이터유형': '데이터유형'
        }

        df = df.rename(columns=column_map)

        if '처리일시' in df.columns:
            df['처리일시'] = pd.to_datetime(df['처리일시'], errors='coerce')
            df['처리일시'] = df['처리일시'].apply(
                lambda x: int(x.strftime('%Y%m%d%H%M%S')) if pd.notna(x) else None
            )

        if '사번' in df.columns:
            df['사번'] = pd.to_numeric(df['사번'], errors='coerce')

        logger.info(f"mdm_data transformation complete: {len(df):,} rows")
        return df


# Registry of transformation functions
TRANSFORM_FUNCTIONS: Dict[str, Callable[[pd.DataFrame], pd.DataFrame]] = {
    "tag_data": DataTransformers.transform_tag_data,
    "claim_data": DataTransformers.transform_claim_data,
    "employees": DataTransformers.transform_organization_data,
    "meal_data": DataTransformers.transform_meal_data,
    "knox_approval": DataTransformers.transform_knox_approval_data,
    "knox_mail": DataTransformers.transform_knox_mail_data,
    "knox_pims": DataTransformers.transform_knox_pims_data,
    "eam_data": DataTransformers.transform_eam_data,
    "equis_data": DataTransformers.transform_equis_data,
    "lams_data": DataTransformers.transform_lams_data,
    "mes_data": DataTransformers.transform_mes_data,
    "mdm_data": DataTransformers.transform_mdm_data,
}


def get_transformer(data_type: str) -> Callable[[pd.DataFrame], pd.DataFrame]:
    """Get transformation function for a data type"""
    if data_type not in TRANSFORM_FUNCTIONS:
        raise ValueError(f"No transformer found for data type: {data_type}")
    return TRANSFORM_FUNCTIONS[data_type]
