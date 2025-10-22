import { contextBridge, ipcRenderer } from 'electron';

// Electron API를 안전하게 노출
contextBridge.exposeInMainWorld('electron', {
  // 앱 경로 가져오기
  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  // Excel 파일 처리 (나중에 Python 연동)
  processExcel: (filePath: string) => ipcRenderer.invoke('process-excel', filePath),

  // 파일 선택 다이얼로그
  selectFile: () => ipcRenderer.invoke('select-file'),
});

// TypeScript 타입 정의
export interface ElectronAPI {
  getAppPath: () => Promise<string>;
  processExcel: (filePath: string) => Promise<{ success: boolean; message: string }>;
  selectFile: () => Promise<string | null>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
