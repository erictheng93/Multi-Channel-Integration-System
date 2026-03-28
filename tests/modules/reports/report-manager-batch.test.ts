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
