import { create } from 'zustand';
import { Rule, RulePriorities } from '../types';

interface RuleStore {
  rules: Rule[];
  priorities: RulePriorities;
  loading: boolean;
  error: string | null;

  // Actions
  setRules: (rules: Rule[]) => void;
  addRule: (rule: Rule) => void;
  updateRule: (id: string, rule: Partial<Rule>) => void;
  removeRule: (id: string) => void;
  setPriorities: (priorities: RulePriorities) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useRuleStore = create<RuleStore>((set, get) => ({
  rules: [],
  priorities: {
    priorityLevelWeight: 0.4,
    fairnessWeight: 0.3,
    costWeight: 0.3,
  },
  loading: false,
  error: null,

  setRules: (rules) => set({ rules }),

  addRule: (rule) => {
    set((state) => ({
      rules: [...state.rules, rule],
    }));
  },

  updateRule: (id, ruleUpdate) => {
    set((state) => ({
      rules: state.rules.map((rule) =>
        rule.id === id ? { ...rule, ...ruleUpdate } : rule
      ),
    }));
  },

  removeRule: (id) => {
    set((state) => ({
      rules: state.rules.filter((rule) => rule.id !== id),
    }));
  },

  setPriorities: (priorities) => set({ priorities }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),
}));