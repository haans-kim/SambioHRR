# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for SAMBIO Excel Uploader (Streamlit app)
Packages the Streamlit data upload application as a standalone executable
"""

from PyInstaller.utils.hooks import collect_all, collect_data_files, collect_submodules

block_cipher = None

# Collect all Streamlit files
streamlit_datas, streamlit_binaries, streamlit_hiddenimports = collect_all('streamlit')
aggrid_datas, aggrid_binaries, aggrid_hiddenimports = collect_all('streamlit_aggrid')

a = Analysis(
    ['run_streamlit.py'],
    pathex=[],
    binaries=[],
    datas=[
        # Main streamlit app
        ('streamlit_app.py', '.'),
        # Application modules
        ('core', 'core'),
        ('handlers', 'handlers'),
        ('models', 'models'),
        ('utils', 'utils'),
        ('.streamlit', '.streamlit'),
        # Add Streamlit data files
    ] + streamlit_datas + aggrid_datas,
    hiddenimports=[
        # Streamlit dependencies
        'streamlit',
        'streamlit.runtime',
        'streamlit.runtime.scriptrunner',
        'streamlit.web.server',
        'streamlit_aggrid',
        'st_aggrid',
        'st_aggrid.grid_options_builder',
        'st_aggrid.shared',
        # Data processing
        'pandas',
        'openpyxl',
        'xlrd',
        'numpy',
        # Other
        'sqlite3',
        'altair',
        'pydeck',
        'validators',
        'watchdog',
        'click',
        'tornado',
        'pympler',
    ] + streamlit_hiddenimports + aggrid_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'IPython',
        'notebook',
        'fastapi',
        'uvicorn',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='ExcelUploader',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # Show console for Streamlit logs
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='ExcelUploader',
)
