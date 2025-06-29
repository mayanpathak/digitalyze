import { create } from 'zustand';
import { UploadFile, UploadStatus } from '../types';

interface UploadStore {
  files: UploadFile[];
  uploadProgress: Record<string, number>;
  uploadStatuses: Record<string, UploadStatus>;
  isUploading: boolean;

  // Actions
  setFiles: (files: UploadFile[]) => void;
  addFile: (file: UploadFile) => void;
  removeFile: (filename: string) => void;
  setUploadProgress: (filename: string, progress: number) => void;
  setUploadStatus: (filename: string, status: UploadStatus) => void;
  setIsUploading: (isUploading: boolean) => void;
  clearUploads: () => void;
}

export const useUploadStore = create<UploadStore>((set, get) => ({
  files: [],
  uploadProgress: {},
  uploadStatuses: {},
  isUploading: false,

  setFiles: (files) => set({ files }),

  addFile: (file) => {
    set((state) => ({
      files: [...state.files, file],
    }));
  },

  removeFile: (filename) => {
    set((state) => ({
      files: state.files.filter((f) => f.filename !== filename),
      uploadProgress: Object.fromEntries(
        Object.entries(state.uploadProgress).filter(([key]) => key !== filename)
      ),
      uploadStatuses: Object.fromEntries(
        Object.entries(state.uploadStatuses).filter(([key]) => key !== filename)
      ),
    }));
  },

  setUploadProgress: (filename, progress) => {
    set((state) => ({
      uploadProgress: {
        ...state.uploadProgress,
        [filename]: progress,
      },
    }));
  },

  setUploadStatus: (filename, status) => {
    set((state) => ({
      uploadStatuses: {
        ...state.uploadStatuses,
        [filename]: status,
      },
    }));
  },

  setIsUploading: (isUploading) => set({ isUploading }),

  clearUploads: () => {
    set({
      files: [],
      uploadProgress: {},
      uploadStatuses: {},
      isUploading: false,
    });
  },
}));