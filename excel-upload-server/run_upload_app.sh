#!/bin/bash
# Run Streamlit Excel Upload App
cd "$(dirname "$0")"
./venv/bin/streamlit run streamlit_app.py --server.port 8501 --server.address localhost
