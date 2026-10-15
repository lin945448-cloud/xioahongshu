import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { monthsOf, uniqSorted } from '@/lib/aggregate';
import type { Note } from '@/types';

export interface FilterOptions {
  accounts: string[];
  categories: string[];
  genres: string[];
  months: string[];
  hasCategory: boolean;
}

export const useFilterOptions = (): FilterOptions => {
  const notes = useStore((s) => s.notes);
  return useMemo(() => {
    const categories = uniqSorted(notes.map((n) => n.category));
    return {
      accounts: uniqSorted(notes.map((n) => n.account)),
      categories,
      genres: uniqSorted(notes.map((n) => n.genre)),
      months: monthsOf(notes),
      hasCategory: !(categories.length === 0 || (categories.length === 1 && categories[0] === '未分类')),
    };
  }, [notes]);
};

export const useFilteredNotes = (): Note[] => {
  const notes = useStore((s) => s.notes);
  const filters = useStore((s) => s.filters);

  return useMemo(() => {
    const { accounts, categories, genres, monthFrom, monthTo, reportingMonths } = filters;
    return notes.filter((n) => {
      if (reportingMonths.length && !reportingMonths.includes(n.reportingMonth ?? n.ym)) return false;
      if (accounts.length && !accounts.includes(n.account)) return false;
      if (categories.length && !categories.includes(n.category)) return false;
      if (genres.length && !genres.includes(n.genre)) return false;
      if (monthFrom && n.ym < monthFrom) return false;
      if (monthTo && n.ym > monthTo) return false;
      return true;
    });
  }, [notes, filters]);
};
