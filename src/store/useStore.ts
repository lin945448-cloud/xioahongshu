import { create } from 'zustand';
import type { Filters, Note, TabKey, UploadedFile } from '@/types';
import { buildDemoData } from '@/lib/demo';

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface State {
  files: UploadedFile[];
  notes: Note[];
  filters: Filters;
  tab: TabKey;
  loading: boolean;
  isDemo: boolean;
  toasts: Toast[];

  addDataset: (notes: Note[], file: UploadedFile) => void;
  removeFile: (fileId: string) => void;
  renameAccount: (fileId: string, name: string) => void;
  setFilters: (patch: Partial<Filters>) => void;
  resetFilters: () => void;
  setTab: (t: TabKey) => void;
  setLoading: (v: boolean) => void;
  clearAll: () => void;
  loadDemo: () => void;
  loadCloudDataset: (files: UploadedFile[], notes: Note[]) => void;
  pushToast: (type: Toast['type'], text: string) => void;
  dismissToast: (id: number) => void;
}

const emptyFilters = (): Filters => ({
  accounts: [],
  categories: [],
  genres: [],
  monthFrom: null,
  monthTo: null,
});

let toastSeq = 0;

export const useStore = create<State>((set, get) => ({
  files: [],
  notes: [],
  filters: emptyFilters(),
  tab: 'overview',
  loading: false,
  isDemo: false,
  toasts: [],

  addDataset: (notes, file) =>
    set((s) => {
      const base = s.isDemo ? { files: [], notes: [] } : { files: s.files, notes: s.notes };
      return {
        isDemo: false,
        files: [...base.files, file],
        notes: [...base.notes, ...notes].sort((a, b) => a.publishAt - b.publishAt),
        filters: emptyFilters(),
      };
    }),

  removeFile: (fileId) =>
    set((s) => ({
      files: s.files.filter((f) => f.id !== fileId),
      notes: s.notes.filter((n) => n.fileId !== fileId),
      filters: emptyFilters(),
    })),

  renameAccount: (fileId, name) =>
    set((s) => ({
      files: s.files.map((f) => (f.id === fileId ? { ...f, account: name } : f)),
      notes: s.notes.map((n) => (n.fileId === fileId ? { ...n, account: name } : n)),
      filters: emptyFilters(),
    })),

  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  resetFilters: () => set({ filters: emptyFilters() }),
  setTab: (tab) => set({ tab }),
  setLoading: (loading) => set({ loading }),

  clearAll: () => set({ files: [], notes: [], filters: emptyFilters(), isDemo: false }),

  loadCloudDataset: (files, notes) =>
    set({
      isDemo: false,
      files,
      notes: [...notes].sort((a, b) => a.publishAt - b.publishAt),
      filters: emptyFilters(),
    }),

  loadDemo: () => {
    const { notes, files } = buildDemoData();
    set({ notes, files, filters: emptyFilters(), isDemo: true });
    get().pushToast('info', '已载入演示数据，可直接体验全部功能');
  },

  pushToast: (type, text) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { id, type, text }] }));
    setTimeout(() => get().dismissToast(id), 4200);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
