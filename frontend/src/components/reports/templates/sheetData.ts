/**
 * Reads the figures a template's sample shows out of the content of the latest report of that type.
 * Shared by the sheet and the picker thumbnails so both draw the same numbers. Nothing here is invented:
 * with no report (or an unreadable one) `live` is false and every list is empty.
 */
import type { ReportType } from '@/types/reports';
import { isRecord, num, type LatestReport } from './latestReport';

export type Tone = 'blue' | 'green' | 'grey';
export interface Part { label: string; value: number; tone: Tone }
export interface AgentBar { name: string; value: number }
export interface SheetData {
  live: boolean;
  isAgents: boolean;
  total: number;
  parts: Part[];
  agents: AgentBar[];
  agentSum: number;
  period: string;
}

const dateFmt = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric' });

export function readSheet(type: ReportType | undefined, state: LatestReport | null): SheetData {
  const raw = state?.content?.data;
  const data: Record<string, unknown> = isRecord(raw) ? raw : {};
  const live = !!state?.report && !!state?.content;
  const isAgents = type === 'agent_performance';

  let period = '近 30 天';
  const p = data.period;
  if (isRecord(p) && typeof p.startDate === 'string' && typeof p.endDate === 'string') {
    const a = new Date(p.startDate);
    const b = new Date(p.endDate);
    if (!Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime())) { period = `${dateFmt.format(a)} – ${dateFmt.format(b)}`; }
  }

  const total = num(data.totalConversations);
  const active = num(data.activeConversations);
  const done = num(data.completedConversations);
  const parts: Part[] = !live || isAgents ? [] : [
    { label: '進行中', value: active, tone: 'blue' },
    { label: '已結案', value: done, tone: 'green' },
    { label: '其他', value: Math.max(0, total - active - done), tone: 'grey' }
  ];

  const agents: AgentBar[] = !live || !isAgents ? [] : (Array.isArray(data.agentMetrics) ? data.agentMetrics.filter(isRecord) : []).map(m => ({
    name: typeof m.agentName === 'string' && m.agentName ? m.agentName : '未命名客服',
    value: num(m.messagesHandled)
  }));
  const agentSum = agents.reduce((sum, a) => sum + a.value, 0);

  return { live, isAgents, total, parts, agents, agentSum, period };
}
