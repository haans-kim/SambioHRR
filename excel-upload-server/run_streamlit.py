#!/usr/bin/env python3
"""
Streamlit App Runner for PyInstaller
PyInstaller 패키징 시 streamlit run 명령을 실행하기 위한 래퍼
"""

import sys
import os
from pathlib import Path

# PyInstaller 패키징 모드 감지
if getattr(sys, 'frozen', False):
    # 패키징된 실행 파일
    bundle_dir = Path(sys._MEIPASS)
else:
    # 개발 모드
    bundle_dir = Path(__file__).parent

# Streamlit 앱 경로
streamlit_script = bundle_dir / 'streamlit_app.py'

if __name__ == '__main__':
    # Streamlit CLI 실행
    from streamlit.web import cli as stcli

    # 기본 포트 8501로 실행
    sys.argv = [
        "streamlit",
        "run",
        str(streamlit_script),
        "--server.port=8501",
        "--server.headless=true",
        "--browser.gatherUsageStats=false",
    ]

    sys.exit(stcli.main())
