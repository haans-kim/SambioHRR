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

        # ✅ FIX: 출입시각은 이미 HHMMSS 정수 형식이므로 변환하지 않음
        # 출입시각 = 70553 → 07:05:53 (시:분:초)
        # pandas가 자동으로 datetime으로 변환하지 않도록 명시적으로 정수로 유지
        if '출입시각' in df.columns:
            df['출입시각'] = pd.to_numeric(df['출입시각'], errors='coerce')

        logger.info(f"tag_data transformation complete: {len(df):,} rows")
        return df

    @staticmethod
    def transform_claim_data(df: pd.DataFrame) -> pd.DataFrame:
        """
        Transform claim_data Excel to DB format
        Excel columns: 근무일, 급여요일, 성명, 사번, 부서, 직급, WORKSCHDTYPNM,
                      근무시간, 시작, 종료, 제외시간, 근태명, 근태코드
        """
        logger.info("Transforming claim_data...")

        # No column mapping needed - DB schema matches Excel structure
        # Just ensure data types are correct

        # Convert 근무일 to datetime format (YYYY-MM-DD HH:MM:SS)
        if '근무일' in df.columns:
            # Handle various date formats
            def parse_date(date_val):
                if pd.isna(date_val):
                    return None
                date_str = str(date_val).strip()

                # Already in correct format
                if '-' in date_str and len(date_str) >= 10:
                    return date_str if ' ' in date_str else date_str + ' 00:00:00'

                # YYYYMMDD format (8 digits)
                if len(date_str) == 8 and date_str.isdigit():
                    return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]} 00:00:00"

                return None

            df['근무일'] = df['근무일'].apply(parse_date)

        # Convert 사번 to integer
        if '사번' in df.columns:
            df['사번'] = pd.to_numeric(df['사번'], errors='coerce')

        # Convert 근무시간 from minutes or "HH:MM" format to decimal hours
        if '근무시간' in df.columns:
            def time_to_hours(time_val):
                """
                Convert various time formats to decimal hours:
                - 숫자 (int/float): 분(minutes) 단위로 간주 (예: 480 → 8.0 hours)
                - "HH:MM" 문자열: 시:분 형식 (예: "8:30" → 8.5 hours)
                """
                if pd.isna(time_val):
                    return None

                # ✅ 숫자 형식 → 분(minutes) 단위로 간주
                if isinstance(time_val, (int, float)):
                    try:
                        minutes = float(time_val)
                        if minutes == 0:
                            return None
                        return minutes / 60.0  # 분을 시간으로 변환
                    except:
                        return None

                # 문자열 형식 (HH:MM)
                time_str = str(time_val).strip()
                if time_str == '' or time_str == '00:00' or time_str == 'nan':
                    return None

                try:
                    # HH:MM 형식
                    if ':' in time_str:
                        parts = time_str.split(':')
                        if len(parts) >= 2:
                            hours = int(parts[0])
                            minutes = int(parts[1])
                            return hours + (minutes / 60.0)

                    # 숫자만 있는 문자열 → 분 단위로 간주
                    if time_str.replace('.', '', 1).isdigit():
                        minutes = float(time_str)
                        return minutes / 60.0

                    return None
                except:
                    return None

            df['근무시간'] = df['근무시간'].apply(time_to_hours)

            # ✅ 근무시간이 비어있으면 시작/종료 시간으로 계산
            if '시작' in df.columns and '종료' in df.columns:
                def calculate_work_hours(row):
                    """시작/종료 시간으로부터 근무시간 계산"""
                    # 근무시간이 이미 있으면 사용
                    if pd.notna(row['근무시간']) and row['근무시간'] > 0:
                        return row['근무시간']

                    # 시작/종료가 없으면 None
                    if pd.isna(row['시작']) or pd.isna(row['종료']):
                        return None

                    try:
                        start = int(row['시작'])
                        end = int(row['종료'])

                        # 숫자 형식: 808 → 08:08, 1453 → 14:53
                        start_hour = start // 100
                        start_min = start % 100
                        end_hour = end // 100
                        end_min = end % 100

                        start_total_mins = start_hour * 60 + start_min
                        end_total_mins = end_hour * 60 + end_min

                        # 자정 넘김 처리
                        if end_total_mins < start_total_mins:
                            end_total_mins += 24 * 60

                        work_mins = end_total_mins - start_total_mins
                        work_hours = work_mins / 60.0

                        # 제외시간 차감 (분 단위 → 시간으로 변환)
                        if '제외시간' in row and pd.notna(row['제외시간']):
                            exclude_mins = float(row['제외시간'])
                            work_hours -= (exclude_mins / 60.0)

                        return max(0, work_hours)
                    except:
                        return None

                # 근무시간 계산 적용
                calculated_count = df['근무시간'].isna().sum()
                if calculated_count > 0:
                    df['근무시간'] = df.apply(calculate_work_hours, axis=1)
                    logger.info(f"시작/종료 시간으로 근무시간 계산: {calculated_count:,}건")

        # ✅ FIX: 실제근무시간이 없으면 근무시간으로 채우기
        if '근무시간' in df.columns:
            if '실제근무시간' not in df.columns:
                # 실제근무시간 컬럼이 아예 없으면 생성
                df['실제근무시간'] = df['근무시간']
                logger.info("실제근무시간 컬럼 생성: 근무시간 값으로 채움")
            else:
                # 실제근무시간 컬럼은 있지만 값이 NULL인 경우 근무시간으로 채움
                null_count = df['실제근무시간'].isna().sum()
                if null_count > 0:
                    df.loc[df['실제근무시간'].isna(), '실제근무시간'] = df.loc[df['실제근무시간'].isna(), '근무시간']
                    logger.info(f"실제근무시간 NULL 값 {null_count:,}개를 근무시간으로 채움")

        # ✅ AUTOMATION: 근태명에서 휴가시간 자동 반영 (연차.휴가반영.md Phase 1)
        if '근태명' in df.columns:
            # 휴가_연차 컬럼 초기화
            if '휴가_연차' not in df.columns:
                df['휴가_연차'] = 0.0
                logger.info("휴가_연차 컬럼 생성 (초기값 0.0)")

            # 근태명 → 휴가시간 매핑 테이블 (휴가만 포함, 출장/교육 제외)
            휴가_매핑 = {
                # 연차/반차
                '년차': 8.0,
                '추가연차': 8.0,
                '오전반차(탄력근무제)': 4.0,
                '오후반차(탄력근무제)': 4.0,
                '2시간 휴가(탄력근무제)': 2.0,
                '4시간 휴가(선택근무제)': 4.0,
                '6시간 휴가(선택근무제)': 6.0,
                '2시간 휴가(선택근무제)': 2.0,

                # 특별휴가
                '장기근속휴가': 8.0,
                '공휴일휴무(탄력)': 8.0,
                '대휴': 8.0,
                '대휴(오전)': 4.0,
                '기타휴무': 8.0,
                '기타결근(연차초과전일)': 8.0,
                '재택근무': 8.0,

                # 경조휴가
                '본인결혼': 8.0,
                '자녀결혼': 8.0,
                '형제자매결혼': 8.0,
                '배우자형제자매결혼': 8.0,
                '부모사망': 8.0,
                '배우자부모사망': 8.0,
                '조부모사망': 8.0,
                '형제자매사망': 8.0,
                '경조휴가': 8.0,
                '부모수연': 8.0,
                '배우자부모수연': 8.0,

                # 출산/육아 휴가
                '출산전후휴가(유급)': 8.0,
                '출산전후휴가(무급)': 8.0,
                '배우자출산휴가': 8.0,
                '임신기 근로시간 단축': 2.0,  # 하루 2시간 단축
                '임신기 근로시간 단축(12~31주)': 2.0,
                '육아기 근로시간 단축(6시간)': 2.0,
                '육아기 근로시간 단축(5시간)': 3.0,

                # 병가/공가
                '직무외병결': 8.0,
                '공가': 8.0,
                '특별휴가': 8.0,

                # 교육/훈련 (근무 외)
                '예비군훈련(전일)': 8.0,
                '종합검진(전일)': 8.0,
                '예비군/민방위 훈련 후 휴식': 8.0,
                '공용외출': 8.0,
            }

            # 근태명별로 휴가시간 설정
            leave_applied_count = 0
            for 근태명, 휴가시간 in 휴가_매핑.items():
                mask = df['근태명'] == 근태명
                if mask.any():
                    df.loc[mask, '휴가_연차'] = 휴가시간
                    leave_applied_count += mask.sum()

            if leave_applied_count > 0:
                logger.info(f"근태명에서 휴가시간 추출: {leave_applied_count:,}건")

            # 실제근무시간에 휴가시간 합산 (핵심 로직!)
            # 이렇게 하면 claim_data 테이블에 이미 휴가가 반영된 근무시간이 저장됨
            if '실제근무시간' in df.columns:
                original_sum = df['실제근무시간'].sum()
                df['실제근무시간'] = df['실제근무시간'] + df['휴가_연차']
                new_sum = df['실제근무시간'].sum()
                added_hours = new_sum - original_sum

                if added_hours > 0:
                    logger.info(f"✅ 실제근무시간에 휴가시간 합산 완료: +{added_hours:,.1f}시간 (총 {leave_applied_count:,}건)")
                    logger.info(f"   예: 년차 = 0h → 8h, 반차 = 6.8h → 10.8h")

            # ✅ AUTOMATION: 출장/교육/파견 처리 (휴가가 아니라 근무)
            # 출장/교육/파견인데 근무시간이 0인 경우 → 표준 8시간 부여
            # 출장/교육/파견인데 근무시간이 있는 경우 → 그대로 유지
            if '실제근무시간' in df.columns:
                출장교육_근태명 = ['사외교육', '국내출장', '해외출장', '출장', '사외파견']

                trip_fixed_count = 0
                for 근태명 in 출장교육_근태명:
                    # 해당 근태명이면서 실제근무시간이 0인 경우
                    mask = (df['근태명'] == 근태명) & (df['실제근무시간'] == 0)
                    if mask.any():
                        df.loc[mask, '실제근무시간'] = 8.0
                        trip_fixed_count += mask.sum()

                if trip_fixed_count > 0:
                    logger.info(f"✅ 출장/교육/파견 근무시간 보정 완료: {trip_fixed_count:,}건 (0h → 8h)")
                    logger.info(f"   예: 사외교육 0h → 8h, 해외출장 11h → 11h, 사외파견 0h → 8h")

        # Convert 시작, 종료 times if present
        for col in ['시작', '종료']:
            if col in df.columns:
                df[col] = df[col].apply(
                    lambda x: str(x).replace(':', '') if pd.notna(x) and str(x) != '' else None
                )

        # ✅ ENHANCEMENT: organization_data에서 조직 정보 자동 채우기
        # 신규 데이터에 조직 정보가 비어있는 경우, 사번으로 조직 마스터에서 가져오기
        if '사번' in df.columns:
            try:
                import sqlite3
                from pathlib import Path

                # 크로스 플랫폼 경로: 현재 파일 기준 2단계 상위의 sambio_human.db
                db_path = Path(__file__).parent.parent.parent / "sambio_human.db"
                if db_path.exists():
                    conn = sqlite3.connect(str(db_path))

                    # organization_data에서 조직 정보 가져오기
                    org_df = pd.read_sql_query(
                        """
                        SELECT
                            사번,
                            성명 as 조직_성명,
                            직급명 as 조직_직급,
                            센터 as 조직_센터,
                            BU as 조직_담당,
                            팀 as 조직_팀,
                            그룹 as 조직_그룹,
                            부서명 as 조직_부서
                        FROM organization_data
                        WHERE 재직상태 = '재직'
                        """,
                        conn
                    )

                    # 사번을 문자열로 통일 (타입 불일치 방지)
                    df['사번'] = df['사번'].astype(str)
                    org_df['사번'] = org_df['사번'].astype(str)

                    # 조직 정보와 JOIN (left join으로 매칭되지 않는 직원도 유지)
                    df = df.merge(org_df, on='사번', how='left')

                    # 비어있는 필드만 조직 정보로 채우기
                    if '성명' in df.columns and '조직_성명' in df.columns:
                        df['성명'] = df['성명'].fillna(df['조직_성명'])
                        df = df.drop(columns=['조직_성명'])

                    if '직급' in df.columns and '조직_직급' in df.columns:
                        df['직급'] = df['직급'].fillna(df['조직_직급'])
                        df = df.drop(columns=['조직_직급'])

                    # 부서 정보 채우기 (claim_data의 '부서' 컬럼)
                    if '부서' in df.columns and '조직_부서' in df.columns:
                        empty_count = df['부서'].isna().sum()
                        if empty_count > 0:
                            df['부서'] = df['부서'].fillna(df['조직_부서'])
                            logger.info(f"조직 정보에서 부서 채움: {empty_count:,}건")
                        df = df.drop(columns=['조직_부서'])

                    # 센터, 담당, 팀, 그룹 정보도 추가 (claim_data에는 원래 없지만 유용할 수 있음)
                    # 하지만 claim_data 스키마에 없으므로 제거
                    for col in ['조직_센터', '조직_담당', '조직_팀', '조직_그룹']:
                        if col in df.columns:
                            df = df.drop(columns=[col])

                    matched_count = len(df)
                    logger.info(f"organization_data에서 조직 정보 매칭 완료: {matched_count:,}건")

                    # ✅ FIX: Set employee_level from 직급 column using grade_level_mapping
                    # 타입 불일치 방지: 양쪽 컬럼을 문자열로 변환
                    if '직급' in df.columns:
                        grade_mapping_df = pd.read_sql_query(
                            """
                            SELECT
                                grade_name,
                                level as employee_level
                            FROM grade_level_mapping
                            """,
                            conn
                        )

                        # 타입을 문자열로 통일
                        df['직급'] = df['직급'].astype(str)
                        grade_mapping_df['grade_name'] = grade_mapping_df['grade_name'].astype(str)

                        # JOIN
                        df = df.merge(
                            grade_mapping_df,
                            left_on='직급',
                            right_on='grade_name',
                            how='left'
                        )

                        # grade_name 컬럼 제거
                        if 'grade_name' in df.columns:
                            df = df.drop(columns=['grade_name'])

                        level_count = df['employee_level'].notna().sum()
                        total_rows = len(df)
                        coverage_pct = (level_count / total_rows * 100) if total_rows > 0 else 0

                        logger.info(f"직급에서 employee_level 설정 완료: {level_count:,}/{total_rows:,}행 ({coverage_pct:.1f}%)")

                        if level_count < total_rows:
                            unmapped_grades = df[df['employee_level'].isna()]['직급'].unique()
                            if len(unmapped_grades) > 0 and len(unmapped_grades) <= 10:
                                logger.warning(f"매핑되지 않은 직급: {', '.join(map(str, unmapped_grades))}")

                    conn.close()

                else:
                    logger.warning("DB 파일 없음 - 조직 정보 자동 채우기 생략")

            except Exception as e:
                logger.warning(f"조직 정보 자동 채우기 실패: {e}")
                import traceback
                logger.warning(traceback.format_exc())

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
        """Transform meal_data Excel to DB format

        Excel columns (30 total):
        NO, 취식일시, 정산일, 식당명, 배식구, 식사가격, 카드번호, 수동입력여부,
        회사코드, 회사, 사원증종류, 카드구분, 기기번호, 사번, Knox ID, 생년월일,
        Domain ID, 성명, 사원구분, 사업장 코드, 사업장, 부서, 직책, 식단,
        테이크아웃, 처리일시, 식사대분류, 식사구분명, 취식이벤트, 취식번호

        These columns match the DB schema exactly, so no column mapping is needed.
        Just ensure correct data types for timestamp and numeric columns.
        """
        logger.info("Transforming meal_data...")

        # No column renaming needed - Excel columns match DB schema exactly

        # Convert timestamp columns to proper format (YYYY-MM-DD HH:MM:SS)
        for time_col in ['취식일시', '처리일시']:
            if time_col in df.columns:
                df[time_col] = pd.to_datetime(df[time_col], errors='coerce')
                df[time_col] = df[time_col].apply(
                    lambda x: x.strftime('%Y-%m-%d %H:%M:%S') if pd.notna(x) else None
                )

        # Convert date column (정산일)
        if '정산일' in df.columns:
            df['정산일'] = pd.to_datetime(df['정산일'], errors='coerce')
            df['정산일'] = df['정산일'].apply(
                lambda x: x.strftime('%Y-%m-%d') if pd.notna(x) else None
            )

        # Convert numeric columns
        if '사번' in df.columns:
            df['사번'] = pd.to_numeric(df['사번'], errors='coerce')

        if 'NO' in df.columns:
            df['NO'] = pd.to_numeric(df['NO'], errors='coerce')

        if '식사가격' in df.columns:
            df['식사가격'] = pd.to_numeric(df['식사가격'], errors='coerce')

        if '카드번호' in df.columns:
            df['카드번호'] = pd.to_numeric(df['카드번호'], errors='coerce')

        if 'Domain ID' in df.columns:
            df['Domain ID'] = pd.to_numeric(df['Domain ID'], errors='coerce')

        if '취식번호' in df.columns:
            df['취식번호'] = pd.to_numeric(df['취식번호'], errors='coerce')

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
        """Transform EAM data Excel to DB format

        Excel columns (new format):
        - Timestamp: 2025-08-01 00:07:15
        - USERNO( ID->사번매칭 ): 20200181.0 (float)
        - Event: "LOGIN"
        - APP: NaN or app name

        DB columns:
        - ATTEMPTDATE (TEXT): Timestamp
        - USERNO (TEXT): USERNO (float → int → str)
        - ATTEMPTRESULT (TEXT): Event
        - APP (TEXT): APP
        """
        logger.info("Transforming eam_data...")

        # 컬럼명 매핑
        column_map = {
            'Timestamp': 'ATTEMPTDATE',
            'USERNO( ID->사번매칭 )': 'USERNO',
            'Event': 'ATTEMPTRESULT',
            'APP': 'APP'
        }

        df = df.rename(columns=column_map)

        # ATTEMPTDATE를 datetime 문자열로 변환
        if 'ATTEMPTDATE' in df.columns:
            df['ATTEMPTDATE'] = pd.to_datetime(df['ATTEMPTDATE'], errors='coerce')
            df['ATTEMPTDATE'] = df['ATTEMPTDATE'].apply(
                lambda x: x.strftime('%Y-%m-%d %H:%M:%S') if pd.notna(x) else None
            )

        # USERNO를 text로 변환 (float → int → str)
        if 'USERNO' in df.columns:
            df['USERNO'] = pd.to_numeric(df['USERNO'], errors='coerce')
            df['USERNO'] = df['USERNO'].apply(
                lambda x: str(int(x)) if pd.notna(x) else None
            )

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
        """Transform LAMS data Excel to DB format

        Excel columns (new format):
        - Timestamp: 2025-08-01 00:00:00.000
        - USERNO( ID->사번매칭 ): 20190146.0 (float)
        - Event: "Create", "Modify"

        DB columns:
        - User_No (REAL): USERNO (float)
        - DATE (TEXT): Timestamp
        - Task (TEXT): Event (소문자)
        """
        logger.info("Transforming lams_data...")

        # 컬럼명 매핑
        column_map = {
            'Timestamp': 'DATE',
            'USERNO( ID->사번매칭 )': 'User_No',
            'Event': 'Task'
        }

        df = df.rename(columns=column_map)

        # DATE를 datetime 문자열로 변환
        if 'DATE' in df.columns:
            df['DATE'] = pd.to_datetime(df['DATE'], errors='coerce')
            df['DATE'] = df['DATE'].apply(
                lambda x: x.strftime('%Y-%m-%d %H:%M:%S') if pd.notna(x) else None
            )

        # User_No는 float로 유지 (DB 컬럼이 REAL)
        if 'User_No' in df.columns:
            df['User_No'] = pd.to_numeric(df['User_No'], errors='coerce')

        # Task를 소문자로 변환
        if 'Task' in df.columns:
            df['Task'] = df['Task'].str.lower()

        logger.info(f"lams_data transformation complete: {len(df):,} rows")
        return df

    @staticmethod
    def transform_mes_data(df: pd.DataFrame) -> pd.DataFrame:
        """Transform MES data Excel to DB format

        Excel columns (new format):
        - Unnamed: 0 (index, empty)
        - DATETIME (KST): 2025-08-01 00:00:04
        - 사번: 20240562
        - APPLICATION: "SBL CEM"

        DB columns:
        - session (TEXT): APPLICATION 값
        - login_time (TIMESTAMP): DATETIME (KST)
        - USERNo (INTEGER): 사번
        """
        logger.info("Transforming mes_data...")

        # 컬럼명 매핑
        column_map = {
            'DATETIME (KST)': 'login_time',
            '사번': 'USERNo',
            'APPLICATION': 'session'
        }

        # Unnamed 컬럼 제거
        df = df.drop(columns=[col for col in df.columns if 'Unnamed' in str(col)], errors='ignore')

        df = df.rename(columns=column_map)

        # login_time을 datetime 형식으로 변환 (문자열 형식 유지)
        if 'login_time' in df.columns:
            df['login_time'] = pd.to_datetime(df['login_time'], errors='coerce')
            df['login_time'] = df['login_time'].apply(
                lambda x: x.strftime('%Y-%m-%d %H:%M:%S') if pd.notna(x) else None
            )

        # USERNo를 integer로 변환
        if 'USERNo' in df.columns:
            df['USERNo'] = pd.to_numeric(df['USERNo'], errors='coerce')

        logger.info(f"mes_data transformation complete: {len(df):,} rows")
        return df

    @staticmethod
    def transform_mdm_data(df: pd.DataFrame) -> pd.DataFrame:
        """Transform MDM data Excel to DB format

        Excel columns (new format):
        - Client: 2025-08-01 06:10:50
        - 사번: 20240616
        - Audit Log Msg. Text: "Logon failed "

        DB columns:
        - UserNo (INTEGER): 사번
        - Timestap (TIMESTAMP): Client (datetime string)
        - task (TEXT): Audit Log Msg. Text (stripped)
        """
        logger.info("Transforming mdm_data...")

        # 컬럼명 매핑
        column_map = {
            'Client': 'Timestap',
            '사번': 'UserNo',
            'Audit Log Msg. Text': 'task'
        }

        df = df.rename(columns=column_map)

        # Timestap을 datetime 문자열로 변환
        if 'Timestap' in df.columns:
            df['Timestap'] = pd.to_datetime(df['Timestap'], errors='coerce')
            df['Timestap'] = df['Timestap'].apply(
                lambda x: x.strftime('%Y-%m-%d %H:%M:%S') if pd.notna(x) else None
            )

        # UserNo를 integer로 변환
        if 'UserNo' in df.columns:
            df['UserNo'] = pd.to_numeric(df['UserNo'], errors='coerce')

        # task 텍스트 정리 (앞뒤 공백 제거)
        if 'task' in df.columns:
            df['task'] = df['task'].str.strip()

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
