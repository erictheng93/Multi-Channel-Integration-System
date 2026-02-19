// Sample Data Generators for Report Preview
// Re-exports from category-specific modules for backward compatibility

import type { ReportType } from '../types/report-types';

import {
  generateConversationData,
  generateAgentData,
  generateAuditTrailData,
  generateCostAnalysisData,
  generateSLAComplianceData
} from './sample-generators-operational';

import {
  generateAnomalyDetectionData,
  generateResourceUtilizationData,
  generateTrendForecastData,
  generateCustomerInsightsData,
  generateChannelIntegrationData
} from './sample-generators-analytics';

import {
  generateGoalAchievementData,
  generateAutomationEffectivenessData,
  generateSecurityRiskData,
  generateKnowledgeBaseData,
  generateCallQualityData,
  generateExecutiveSummaryData
} from './sample-generators-strategic';

/**
 * Sample Data Generators for Report Preview
 * Provides static methods to generate sample data for each report type
 */
export class SampleDataGenerators {
  /**
   * Get sample data for a specific report type
   * @param reportType - The type of report to generate sample data for
   * @returns Sample data for the report type, or null if not available
   */
  static getSampleData(reportType: ReportType): unknown {
    switch (reportType) {
      case 'conversation_summary':
        return generateConversationData();
      case 'agent_performance':
        return generateAgentData();
      case 'cost_analysis':
        return generateCostAnalysisData();
      case 'sla_compliance':
        return generateSLAComplianceData();
      case 'anomaly_detection':
        return generateAnomalyDetectionData();
      case 'audit_trail':
        return generateAuditTrailData();
      case 'resource_utilization':
        return generateResourceUtilizationData();
      case 'trend_forecast':
        return generateTrendForecastData();
      case 'customer_insights':
        return generateCustomerInsightsData();
      case 'channel_integration':
        return generateChannelIntegrationData();
      case 'goal_achievement':
        return generateGoalAchievementData();
      case 'automation_effectiveness':
        return generateAutomationEffectivenessData();
      case 'security_risk':
        return generateSecurityRiskData();
      case 'knowledge_base':
        return generateKnowledgeBaseData();
      case 'call_quality':
        return generateCallQualityData();
      case 'executive_summary':
        return generateExecutiveSummaryData();
      default:
        return null;
    }
  }
}
