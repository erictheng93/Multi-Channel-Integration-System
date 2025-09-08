// 檔案上傳相關類型定義
// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/frontend/src/types/file-upload.ts
// Created by: Type Definition Developer

export interface FileUploadItem {
  id?: string;
  name: string;
  size?: number;
  type?: string;
  file?: globalThis.File;
  url?: string;
  progress?: number;
  uploading?: boolean;
  uploaded?: boolean;
  error?: string;
  retryCount?: number;
}

export interface FileUploadProps {
  modelValue?: FileUploadItem[];
  multiple?: boolean;
  maxSize?: number; // in bytes
  maxFiles?: number;
  acceptedTypes?: string;
  uploadFunction?: (_file: globalThis.File) => Promise<string>;
  disabled?: boolean;
  showDropZone?: boolean;
}

/* eslint-disable no-unused-vars */
export interface FileUploadEmits {
  (e: 'update:modelValue', files: FileUploadItem[]): void;
  (e: 'upload-complete', file: FileUploadItem): void;
  (e: 'upload-error', file: FileUploadItem, error: string): void;
  (e: 'file-remove', file: FileUploadItem): void;
  (e: 'file-select', files: globalThis.File[]): void;
}
/* eslint-enable no-unused-vars */

export interface FileUploadResult {
  url: string;
  filename: string;
  size?: number;
  type?: string;
}