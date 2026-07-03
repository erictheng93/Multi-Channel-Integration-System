import { describe, expect, it } from 'vitest';
import { summarizeAudience } from '@/modules/broadcast/services/audience-service';

describe('summarizeAudience', () => {
  it('counts LINE recipients as sendable and non-LINE recipients as skipped', () => {
    const preview = summarizeAudience([
      { customerId: 1, platform: 'line', platformUserId: 'U1', resolvedTeamId: 10 },
      { customerId: 2, platform: 'facebook', platformUserId: 'F1', resolvedTeamId: 10 },
      { customerId: 3, platform: 'line', platformUserId: 'U2', resolvedTeamId: null },
    ]);

    expect(preview).toEqual({
      total: 3,
      byPlatform: {
        line: 2,
        facebook: 1,
      },
      sendable: 2,
      skipped: [{ reason: 'platform_not_supported_phase1', count: 1 }],
    });
  });

  it('omits skipped reasons when all recipients are LINE users', () => {
    const preview = summarizeAudience([
      { customerId: 1, platform: 'line', platformUserId: 'U1', resolvedTeamId: 10 },
    ]);

    expect(preview.skipped).toEqual([]);
    expect(preview.sendable).toBe(1);
  });
});
