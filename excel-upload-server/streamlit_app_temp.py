def render_data_status_table():
    """데이터 상태 테이블 렌더링"""
    df_status = get_data_stats()

    if not df_status.empty:
        # 정렬을 위한 컬럼 설정
        column_config = {
            "데이터 유형": st.column_config.TextColumn(
                "데이터 유형",
                width="medium",
            ),
            "테이블명": st.column_config.TextColumn(
                "테이블명",
                width="medium",
            ),
            "데이터 기간": st.column_config.TextColumn(
                "데이터 기간",
                width="large",
            ),
            "마지막 업로드": st.column_config.TextColumn(
                "마지막 업로드",
                width="medium",
            ),
            "데이터 수": st.column_config.TextColumn(
                "데이터 수",
                width="medium",
            ),
        }

        st.dataframe(
            df_status,
            use_container_width=True,
            hide_index=True,
            column_config=column_config
        )
    else:
        st.warning("데이터 상태를 불러올 수 없습니다.")
