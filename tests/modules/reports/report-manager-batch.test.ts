import { describe, it, expect, vi } from 'vitest';
import { ReportManagerService } from '@modules/reports/services/report-manager-service';

describe('ReportManagerService.batchOperation — export action', () => {
  it('should delegate export to downloadReport', async () => {
    const mockGenerator = {
      getReportStatus: vi.fn().mockResolvedValue({
        id: 'report-1',
        status: 'completed',
        type: 'conversation_summary',
        title: 'Test Report',
        format: 'json',
        downloadUrl: '/api/reports/report-1/download'
      }),
      downloadReport: vi.fn().mockResolvedValue({
        url: '/api/reports/report-1/download',
        filename: 'Test_Report.json'
      })
    };

    const mockUtils = {
      checkDownloadPermission: vi.fn().mockResolvedValue(true)
    };

    const mockDb = {} as any;
    const service = new ReportManagerService(mockDb);

    const result = await service.batchOperation(
      { reportIds: ['report-1'], action: 'export' },
      'user-1',
      mockGenerator as any,
      mockUtils as any
    );

    expect(result.results[0].success).toBe(true);
    expect(result.results[0].downloadUrl).toBe('/api/reports/report-1/download');
    expect(mockGenerator.downloadReport).toHaveBeenCalledWith('report-1', 'user-1', mockUtils);
  });
});

describe('ReportManagerService.batchOperation - visibility', () => {
  const report = { id: 'r1', createdBy: 'someone-else', teamId: 9, type: 'custom', title: 'T', format: 'json', metadata: {} };

  it('regenerate of a report the caller cannot see is "not found" and generates nothing', async () => {
    const { ReportAccessDeniedError } = await import('@modules/reports/types/report-types');
    const generator = { getReportStatus: vi.fn().mockResolvedValue(report), generateReport: vi.fn() };
    const utils = { checkDownloadPermission: vi.fn().mockRejectedValue(new ReportAccessDeniedError('no')) };

    const result = await new ReportManagerService({} as any).batchOperation(
      { reportIds: ['r1'], action: 'regenerate' }, 'agent-1', generator as any, utils as any
    );

    expect(result.results[0]).toEqual({ reportId: 'r1', success: false, error: 'Report not found' });
    expect(generator.generateReport).not.toHaveBeenCalled();
  });

  it('regenerate works for a visible report', async () => {
    const generator = { getReportStatus: vi.fn().mockResolvedValue(report), generateReport: vi.fn().mockResolvedValue({}) };
    const utils = { checkDownloadPermission: vi.fn().mockResolvedValue(undefined) };

    const result = await new ReportManagerService({} as any).batchOperation(
      { reportIds: ['r1'], action: 'regenerate' }, 'admin-1', generator as any, utils as any
    );

    expect(result.results[0].success).toBe(true);
    expect(generator.generateReport).toHaveBeenCalledOnce();
  });
});
