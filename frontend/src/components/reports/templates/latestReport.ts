/**
 * Loads the real output of the latest completed JSON report of one type, plus the few reports before it.
 * Nothing is invented: with no report yet the result is empty and the UI shows a skeleton.
 */
import { ref, watch, type Ref } from 'vue';
import ReportsAPI from '@/api/reports';
import type { ReportBase, ReportType } from '@/types/reports';

export interface LatestReport {
  report: ReportBase | null;
  content: Record<string, unknown> | null;
  failed: boolean;
  recent: ReportBase[];
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

export function relativeTime(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) { return '剛剛'; }
  if (mins < 60) { return `${mins} 分鐘前`; }
  return mins < 1440 ? `${Math.floor(mins / 60)} 小時前` : `${Math.floor(mins / 1440)} 天前`;
}

async function fetchLatest(type: ReportType): Promise<LatestReport> {
  let recent: ReportBase[] = [];
  let report: ReportBase | null = null;
  try {
    const list = await ReportsAPI.listReports({ type, page: 1, pageSize: 6, sortBy: 'createdAt', sortOrder: 'desc' });
    recent = list.reports.filter(item => item.type === type);
    report = recent.find(item => item.status === 'completed' && item.format === 'json') ?? null;
    const content = report ? await ReportsAPI.getReportJsonContent(report.id) : null;
    return { report, content, failed: false, recent };
  } catch {
    return { report, content: null, failed: true, recent };
  }
}

/** Reactive loader: re-runs whenever the template type changes; each page entry refetches so a freshly generated report shows up; failures are never kept */
export function useLatestReport(type: Ref<ReportType | undefined>) {
  const state = ref<LatestReport | null>(null);
  const loading = ref(false);
  let token = 0;

  watch(type, async next => {
    if (!next) { state.value = null; return; }
    const mine = ++token;
    loading.value = true;
    const result = await fetchLatest(next);
    if (mine !== token) { return; }
    state.value = result;
    loading.value = false;
  }, { immediate: true });

  return { state, loading };
}

/** Several types at once (the picker thumbnails): one reactive map, each type fetched fresh on every entry */
export function useLatestByType(types: Ref<ReportType[]>) {
  const states = ref<Partial<Record<ReportType, LatestReport>>>({});
  watch(types, async list => {
    await Promise.all(list.map(async type => {
      const result = await fetchLatest(type);
      states.value = { ...states.value, [type]: result };
    }));
  }, { immediate: true });
  return states;
}
