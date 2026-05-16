import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { ReportGeneratorService } from '@modules/reports/services/report-generator-service';
import { validateReportId } from '@modules/reports/middleware/reports-validation';

const reportUuid = '123e4567-e89b-42d3-a456-426614174000';

describe('Reports download pipeline', () => {
  it('accepts legacy generated report_<uuid> IDs in route validation', async () => {
    const app = new Hono<{ Bindings: Bindings }>();
    app.get('/reports/:id', validateReportId, (c) => c.json({ reportId: c.get('reportId') }));

    const response = await app.request(`/reports/report_${reportUuid}`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ reportId: `report_${reportUuid}` });
  });

  it('loads completed report content from R2 for downloads', async () => {
    const body = new ReadableStream();
    const r2Object = {
      body,
      size: 42,
      httpMetadata: {
        contentType: 'application/json',
      },
    };
    const r2Bucket = {
      get: vi.fn().mockResolvedValue(r2Object),
    };

    const service = new ReportGeneratorService({
      DB: {},
      R2_BUCKET: r2Bucket,
    } as unknown as Bindings);

    vi.spyOn(service, 'getReportStatus').mockResolvedValue({
      id: reportUuid,
      title: 'Daily Summary',
      type: 'conversation_summary',
      format: 'json',
      status: 'completed',
      createdBy: 'user-1',
      createdAt: '2026-05-16T00:00:00.000Z',
      downloadUrl: `/api/reports/${reportUuid}/download`,
    });
    vi.spyOn(service, 'logDownload').mockResolvedValue();

    const result = await service.downloadReport(reportUuid, 'user-1', {
      checkDownloadPermission: vi.fn().mockResolvedValue(undefined),
    } as unknown as Parameters<ReportGeneratorService['downloadReport']>[2]);
    const download = result as {
      body?: ReadableStream;
      contentType?: string;
      fileSize?: number;
      filename?: string;
    } | null;

    expect(r2Bucket.get).toHaveBeenCalledWith(`reports/${reportUuid}.json`);
    expect(download?.body).toBe(body);
    expect(download?.contentType).toBe('application/json');
    expect(download?.fileSize).toBe(42);
    expect(download?.filename).toBe('Daily_Summary.json');
  });
});
