import { create } from 'zustand';
import { EntityType, EntityData, EntityFilters } from '../types';

interface DataStore {
  // Current entity state
  currentEntity: EntityType;
  entities: Record<string, EntityData[]>;
  loading: boolean;
  error: string | null;

  // Filters and pagination
  filters: EntityFilters;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  // Selected items
  selectedItems: string[];

  // Actions
  setCurrentEntity: (entity: EntityType) => void;
  setEntities: (entity: EntityType, data: EntityData[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setFilters: (filters: Partial<EntityFilters>) => void;
  setPagination: (pagination: Partial<DataStore['pagination']>) => void;
  setSelectedItems: (items: string[]) => void;
  addEntity: (entity: EntityType, data: EntityData) => void;
  updateEntity: (entity: EntityType, id: string, data: Partial<EntityData>) => void;
  removeEntity: (entity: EntityType, id: string) => void;
  clearFilters: () => void;
}

export const useDataStore = create<DataStore>((set, get) => ({
  currentEntity: 'clients',
  entities: {
    clients: [],
    workers: [],
    tasks: [],
  },
  loading: false,
  error: null,
  filters: {},
  pagination: {
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  },
  selectedItems: [],

  setCurrentEntity: (entity) => {
    set({ currentEntity: entity, selectedItems: [] });
  },

  setEntities: (entity, data) => {
    set((state) => ({
      entities: {
        ...state.entities,
        [entity]: data,
      },
    }));
  },

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
      pagination: { ...state.pagination, page: 1 }, // Reset to first page
    }));
  },

  setPagination: (pagination) => {
    set((state) => ({
      pagination: { ...state.pagination, ...pagination },
    }));
  },

  setSelectedItems: (items) => set({ selectedItems: items }),

  addEntity: (entity, data) => {
    set((state) => ({
      entities: {
        ...state.entities,
        [entity]: [data, ...state.entities[entity]],
      },
    }));
  },

  updateEntity: (entity, id, data) => {
    set((state) => ({
      entities: {
        ...state.entities,
        [entity]: state.entities[entity].map((item) =>
          item.id === id ? { ...item, ...data } : item
        ),
      },
    }));
  },

  removeEntity: (entity, id) => {
    set((state) => ({
      entities: {
        ...state.entities,
        [entity]: state.entities[entity].filter((item) => item.id !== id),
      },
    }));
  },

  clearFilters: () => {
    set({
      filters: {},
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    });
  },
}));