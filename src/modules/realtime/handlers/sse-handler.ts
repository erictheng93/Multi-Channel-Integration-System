// SSE Handler Stub
// This file exists for backward compatibility with tests
// SSE功能已在 Phase 3 移除，此文件僅作為測試存根

export const enhancedSSEManager = {
  getDetailedStats() {
    // 此方法在測試中會被 mock 覆蓋
    return {
      totalConnections: 0,
      connectionsByUser: {},
      connectionsByConversation: {},
      averageUptime: 0,
      totalEventsSent: 0
    };
  }
};
