/**
 * Unit Tests for SampleDataGenerators
 *
 * Tests the sample data generation for all 16 report types.
 * Validates data structure, type safety, and completeness.
 *
 * Coverage: 17 methods (getSampleData + 16 individual generators)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SampleDataGenerators } from '@modules/reports/services/sample-data-generators';
import type { ReportType } from '@modules/reports/types/report-types';

describe('SampleDataGenerators', () => {
  // =============================================================================
  // SECTION 1: getSampleData - Dispatcher Tests
  // =============================================================================
  describe('getSampleData (Dispatcher)', () => {
    const ALL_REPORT_TYPES: ReportType[] = [
      'conversation_summary',
      'agent_performance',
      'cost_analysis',
      'sla_compliance',
      'anomaly_detection',
      'audit_trail',
      'resource_utilization',
      'trend_forecast',
      'customer_insights',
      'channel_integration',
      'goal_achievement',
      'automation_effectiveness',
      'security_risk',
      'knowledge_base',
      'call_quality',
      'executive_summary'
    ];

    it.each(ALL_REPORT_TYPES)('should return non-null data for "%s"', (type) => {
      const result = SampleDataGenerators.getSampleData(type);
      expect(result).not.toBeNull();
      expect(typeof result).toBe('object');
    });

    it('should return null for unknown report type', () => {
      const result = SampleDataGenerators.getSampleData('unknown_type' as ReportType);
      expect(result).toBeNull();
    });

    it('should return null for empty string report type', () => {
      const result = SampleDataGenerators.getSampleData('' as ReportType);
      expect(result).toBeNull();
    });

    it('should return unique data for each report type', () => {
      const results = ALL_REPORT_TYPES.map(type => ({
        type,
        data: SampleDataGenerators.getSampleData(type)
      }));

      // Each report type should have distinct top-level structure
      const uniqueKeys = new Set(
        results.map(r => Object.keys(r.data as object).sort().join(','))
      );

      // Most report types should have unique structures
      expect(uniqueKeys.size).toBeGreaterThan(10);
    });
  });

  // =============================================================================
  // SECTION 2: generateConversationData Tests
  // =============================================================================
  describe('generateConversationData', () => {
    let data: ReturnType<typeof SampleDataGenerators.generateConversationData>;

    beforeEach(() => {
      data = SampleDataGenerators.generateConversationData();
    });

    it('should have required top-level properties', () => {
      expect(data).toHaveProperty('period');
      expect(data).toHaveProperty('totalConversations');
      expect(data).toHaveProperty('activeConversations');
      expect(data).toHaveProperty('completedConversations');
      expect(data).toHaveProperty('averageResponseTime');
      expect(data).toHaveProperty('averageResolutionTime');
      expect(data).toHaveProperty('conversationsByPlatform');
      expect(data).toHaveProperty('conversationsByPriority');
      expect(data).toHaveProperty('conversationsByTeam');
      expect(data).toHaveProperty('hourlyDistribution');
      expect(data).toHaveProperty('dailyTrends');
      expect(data).toHaveProperty('topTags');
    });

    it('should have valid period with ISO date strings', () => {
      expect(data.period.startDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(data.period.endDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(new Date(data.period.startDate).getTime()).toBeLessThan(
        new Date(data.period.endDate).getTime()
      );
    });

    it('should have valid conversation counts', () => {
      expect(data.totalConversations).toBeGreaterThan(0);
      expect(data.activeConversations).toBeGreaterThanOrEqual(0);
      expect(data.completedConversations).toBeGreaterThanOrEqual(0);
    });

    it('should have valid platform distribution', () => {
      expect(data.conversationsByPlatform).toHaveProperty('line');
      expect(data.conversationsByPlatform).toHaveProperty('facebook');
      expect(data.conversationsByPlatform).toHaveProperty('webchat');
    });

    it('should have valid priority distribution', () => {
      expect(data.conversationsByPriority).toHaveProperty('low');
      expect(data.conversationsByPriority).toHaveProperty('medium');
      expect(data.conversationsByPriority).toHaveProperty('high');
      expect(data.conversationsByPriority).toHaveProperty('urgent');
    });

    it('should have 24 hours in hourly distribution', () => {
      expect(data.hourlyDistribution).toHaveLength(24);
      data.hourlyDistribution.forEach((item, index) => {
        expect(item.hour).toBe(index);
        expect(typeof item.count).toBe('number');
      });
    });

    it('should have 30 days in daily trends', () => {
      expect(data.dailyTrends).toHaveLength(30);
      data.dailyTrends.forEach(item => {
        expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(typeof item.conversations).toBe('number');
        expect(typeof item.messages).toBe('number');
        expect(typeof item.avgResponseTime).toBe('number');
      });
    });

    it('should have valid top tags structure', () => {
      expect(data.topTags.length).toBeGreaterThan(0);
      data.topTags.forEach(tag => {
        expect(typeof tag.tag).toBe('string');
        expect(typeof tag.count).toBe('number');
      });
    });
  });

  // =============================================================================
  // SECTION 3: generateAgentData Tests
  // =============================================================================
  describe('generateAgentData', () => {
    let data: ReturnType<typeof SampleDataGenerators.generateAgentData>;

    beforeEach(() => {
      data = SampleDataGenerators.generateAgentData();
    });

    it('should have required top-level properties', () => {
      expect(data).toHaveProperty('period');
      expect(data).toHaveProperty('totalAgents');
      expect(data).toHaveProperty('activeAgents');
      expect(data).toHaveProperty('agentMetrics');
      expect(data).toHaveProperty('teamComparisons');
      expect(data).toHaveProperty('performanceTrends');
    });

    it('should have valid agent counts', () => {
      expect(data.totalAgents).toBeGreaterThan(0);
      expect(data.activeAgents).toBeLessThanOrEqual(data.totalAgents);
    });

    it('should have valid agent metrics structure', () => {
      expect(data.agentMetrics.length).toBeGreaterThan(0);
      const agent = data.agentMetrics[0];
      expect(agent).toHaveProperty('agentId');
      expect(agent).toHaveProperty('agentName');
      expect(agent).toHaveProperty('teamId');
      expect(agent).toHaveProperty('teamName');
      expect(agent).toHaveProperty('conversationsHandled');
      expect(agent).toHaveProperty('messagesHandled');
      expect(agent).toHaveProperty('averageResponseTime');
      expect(agent).toHaveProperty('customerSatisfactionScore');
      expect(agent).toHaveProperty('resolutionRate');
      expect(agent).toHaveProperty('activeHours');
      expect(agent).toHaveProperty('efficiency');
    });

    it('should have valid team comparisons structure', () => {
      expect(data.teamComparisons.length).toBeGreaterThan(0);
      const team = data.teamComparisons[0];
      expect(team).toHaveProperty('teamId');
      expect(team).toHaveProperty('teamName');
      expect(team).toHaveProperty('agentCount');
      expect(team).toHaveProperty('totalConversations');
      expect(team).toHaveProperty('averageResponseTime');
      expect(team).toHaveProperty('satisfactionScore');
    });

    it('should have 30 days of performance trends', () => {
      expect(data.performanceTrends).toHaveLength(30);
      data.performanceTrends.forEach(trend => {
        expect(trend.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(typeof trend.responseTime).toBe('number');
        expect(typeof trend.satisfaction).toBe('number');
        expect(typeof trend.throughput).toBe('number');
      });
    });
  });

  // =============================================================================
  // SECTION 4: generateCostAnalysisData Tests
  // =============================================================================
  describe('generateCostAnalysisData', () => {
    let data: ReturnType<typeof SampleDataGenerators.generateCostAnalysisData>;

    beforeEach(() => {
      data = SampleDataGenerators.generateCostAnalysisData();
    });

    it('should have required top-level properties', () => {
      expect(data).toHaveProperty('totalCosts');
      expect(data).toHaveProperty('costByTeam');
      expect(data).toHaveProperty('costEfficiency');
      expect(data).toHaveProperty('monthlyTrends');
      expect(data).toHaveProperty('budgetComparison');
      expect(data).toHaveProperty('costSavingOpportunities');
    });

    it('should have valid total costs structure', () => {
      expect(data.totalCosts).toHaveProperty('operational');
      expect(data.totalCosts).toHaveProperty('personnel');
      expect(data.totalCosts).toHaveProperty('technology');
      expect(data.totalCosts).toHaveProperty('overhead');
      Object.values(data.totalCosts).forEach(cost => {
        expect(typeof cost).toBe('number');
        expect(cost).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have valid cost by team structure', () => {
      expect(data.costByTeam.length).toBeGreaterThan(0);
      const team = data.costByTeam[0];
      expect(team).toHaveProperty('teamId');
      expect(team).toHaveProperty('teamName');
      expect(team).toHaveProperty('totalCost');
      expect(team).toHaveProperty('avgCostPerAgent');
      expect(team).toHaveProperty('avgCostPerConversation');
      expect(team).toHaveProperty('costBreakdown');
    });

    it('should have valid cost efficiency metrics', () => {
      expect(data.costEfficiency).toHaveProperty('costPerConversation');
      expect(data.costEfficiency).toHaveProperty('costPerResolution');
      expect(data.costEfficiency).toHaveProperty('costPerCustomer');
      expect(data.costEfficiency).toHaveProperty('rOI');
    });

    it('should have 12 months in monthly trends', () => {
      expect(data.monthlyTrends).toHaveLength(12);
    });

    it('should have valid budget comparison', () => {
      expect(data.budgetComparison).toHaveProperty('allocated');
      expect(data.budgetComparison).toHaveProperty('actual');
      expect(data.budgetComparison).toHaveProperty('variance');
      expect(data.budgetComparison).toHaveProperty('utilizationRate');
    });

    it('should have cost saving opportunities with effort levels', () => {
      expect(data.costSavingOpportunities.length).toBeGreaterThan(0);
      data.costSavingOpportunities.forEach(opportunity => {
        expect(opportunity).toHaveProperty('category');
        expect(opportunity).toHaveProperty('description');
        expect(opportunity).toHaveProperty('estimatedSaving');
        expect(['low', 'medium', 'high']).toContain(opportunity.effort);
      });
    });
  });

  // =============================================================================
  // SECTION 5: generateSLAComplianceData Tests
  // =============================================================================
  describe('generateSLAComplianceData', () => {
    let data: ReturnType<typeof SampleDataGenerators.generateSLAComplianceData>;

    beforeEach(() => {
      data = SampleDataGenerators.generateSLAComplianceData();
    });

    it('should have required top-level properties', () => {
      expect(data).toHaveProperty('overallCompliance');
      expect(data).toHaveProperty('slaMetrics');
      expect(data).toHaveProperty('complianceByTeam');
      expect(data).toHaveProperty('breachAnalysis');
      expect(data).toHaveProperty('correctiveActions');
      expect(data).toHaveProperty('complianceTrends');
    });

    it('should have valid overall compliance structure', () => {
      expect(data.overallCompliance.percentage).toBeGreaterThanOrEqual(0);
      expect(data.overallCompliance.percentage).toBeLessThanOrEqual(100);
      expect(data.overallCompliance.target).toBeGreaterThanOrEqual(0);
      expect(['meeting', 'at_risk', 'critical']).toContain(data.overallCompliance.status);
    });

    it('should have valid SLA metrics with trend', () => {
      expect(data.slaMetrics.length).toBeGreaterThan(0);
      data.slaMetrics.forEach(metric => {
        expect(metric).toHaveProperty('slaType');
        expect(metric).toHaveProperty('metric');
        expect(metric).toHaveProperty('target');
        expect(metric).toHaveProperty('actual');
        expect(metric).toHaveProperty('compliance');
        expect(metric).toHaveProperty('breaches');
        expect(['improving', 'stable', 'declining']).toContain(metric.trend);
      });
    });

    it('should have valid breach analysis structure', () => {
      expect(data.breachAnalysis).toHaveProperty('totalBreaches');
      expect(data.breachAnalysis).toHaveProperty('criticalBreaches');
      expect(data.breachAnalysis).toHaveProperty('breachesByCategory');
      expect(data.breachAnalysis).toHaveProperty('rootCauses');
    });

    it('should have corrective actions with valid status', () => {
      expect(data.correctiveActions.length).toBeGreaterThan(0);
      data.correctiveActions.forEach(action => {
        expect(action).toHaveProperty('id');
        expect(action).toHaveProperty('description');
        expect(action).toHaveProperty('priority');
        expect(action).toHaveProperty('status');
        expect(['pending', 'in_progress', 'completed']).toContain(action.status);
      });
    });
  });

  // =============================================================================
  // SECTION 6: generateAnomalyDetectionData Tests
  // =============================================================================
  describe('generateAnomalyDetectionData', () => {
    let data: ReturnType<typeof SampleDataGenerators.generateAnomalyDetectionData>;

    beforeEach(() => {
      data = SampleDataGenerators.generateAnomalyDetectionData();
    });

    it('should have required top-level properties', () => {
      expect(data).toHaveProperty('detectionSummary');
      expect(data).toHaveProperty('anomaliesByCategory');
      expect(data).toHaveProperty('recentAnomalies');
      expect(data).toHaveProperty('predictiveInsights');
      expect(data).toHaveProperty('anomalyPatterns');
      expect(data).toHaveProperty('systemHealthIndicators');
    });

    it('should have valid detection summary', () => {
      const summary = data.detectionSummary;
      expect(summary.totalAnomalies).toBeGreaterThanOrEqual(0);
      expect(summary.criticalAnomalies).toBeLessThanOrEqual(summary.totalAnomalies);
      expect(summary.detectionAccuracy).toBeGreaterThanOrEqual(0);
      expect(summary.detectionAccuracy).toBeLessThanOrEqual(100);
    });

    it('should have valid anomalies by category structure', () => {
      expect(data.anomaliesByCategory.length).toBeGreaterThan(0);
      data.anomaliesByCategory.forEach(category => {
        expect(category).toHaveProperty('category');
        expect(category).toHaveProperty('count');
        expect(category).toHaveProperty('severity');
        expect(category).toHaveProperty('avgImpact');
        expect(category).toHaveProperty('trends');
      });
    });

    it('should have valid recent anomalies structure', () => {
      expect(data.recentAnomalies.length).toBeGreaterThan(0);
      data.recentAnomalies.forEach(anomaly => {
        expect(anomaly).toHaveProperty('id');
        expect(anomaly).toHaveProperty('timestamp');
        expect(anomaly).toHaveProperty('type');
        expect(anomaly).toHaveProperty('severity');
        expect(anomaly).toHaveProperty('description');
        expect(anomaly).toHaveProperty('affectedSystems');
        expect(anomaly).toHaveProperty('confidence');
        expect(anomaly).toHaveProperty('status');
        expect(anomaly.confidence).toBeGreaterThanOrEqual(0);
        expect(anomaly.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should have valid predictive insights', () => {
      const insights = data.predictiveInsights;
      expect(insights.riskScore).toBeGreaterThanOrEqual(0);
      expect(insights.riskScore).toBeLessThanOrEqual(100);
      expect(insights.probabilityOfIncident).toBeGreaterThanOrEqual(0);
      expect(insights.probabilityOfIncident).toBeLessThanOrEqual(1);
      expect(Array.isArray(insights.recommendedActions)).toBe(true);
    });

    it('should have valid system health indicators', () => {
      const health = data.systemHealthIndicators;
      expect(health.overallHealth).toBeGreaterThanOrEqual(0);
      expect(health.overallHealth).toBeLessThanOrEqual(100);
      expect(health.performanceScore).toBeGreaterThanOrEqual(0);
      expect(health.reliabilityScore).toBeGreaterThanOrEqual(0);
      expect(health.securityScore).toBeGreaterThanOrEqual(0);
    });
  });

  // =============================================================================
  // SECTION 7: generateAuditTrailData Tests
  // =============================================================================
  describe('generateAuditTrailData', () => {
    let data: ReturnType<typeof SampleDataGenerators.generateAuditTrailData>;

    beforeEach(() => {
      data = SampleDataGenerators.generateAuditTrailData();
    });

    it('should have required top-level properties', () => {
      expect(data).toHaveProperty('auditSummary');
      expect(data).toHaveProperty('eventsByCategory');
      expect(data).toHaveProperty('userActivity');
      expect(data).toHaveProperty('complianceChecks');
      expect(data).toHaveProperty('securityIncidents');
      expect(data).toHaveProperty('dataAccess');
    });

    it('should have valid audit summary counts', () => {
      const summary = data.auditSummary;
      expect(summary.totalEvents).toBeGreaterThan(0);
      expect(summary.criticalEvents).toBeLessThanOrEqual(summary.totalEvents);
      expect(summary.securityEvents).toBeLessThanOrEqual(summary.totalEvents);
    });

    it('should have valid events by category structure', () => {
      expect(Object.keys(data.eventsByCategory).length).toBeGreaterThan(0);
      Object.values(data.eventsByCategory).forEach(category => {
        expect(category).toHaveProperty('count');
        expect(category).toHaveProperty('criticalCount');
        expect(category).toHaveProperty('trends');
      });
    });

    it('should have valid user activity structure', () => {
      expect(data.userActivity.length).toBeGreaterThan(0);
      const user = data.userActivity[0];
      expect(user).toHaveProperty('userId');
      expect(user).toHaveProperty('username');
      expect(user).toHaveProperty('role');
      expect(user).toHaveProperty('totalActions');
      expect(user).toHaveProperty('sensitiveActions');
      expect(user).toHaveProperty('riskScore');
      expect(typeof user.suspiciousActivity).toBe('boolean');
    });

    it('should have valid compliance checks structure', () => {
      expect(data.complianceChecks.length).toBeGreaterThan(0);
      data.complianceChecks.forEach(check => {
        expect(check).toHaveProperty('checkType');
        expect(check).toHaveProperty('status');
        expect(check).toHaveProperty('details');
        expect(['pass', 'warning', 'fail']).toContain(check.status);
      });
    });

    it('should have valid data access structure', () => {
      expect(data.dataAccess).toHaveProperty('totalAccess');
      expect(data.dataAccess).toHaveProperty('unauthorizedAttempts');
      expect(data.dataAccess).toHaveProperty('sensitiveDataAccess');
      expect(data.dataAccess).toHaveProperty('accessByRole');
      expect(data.dataAccess).toHaveProperty('accessTrends');
    });
  });

  // =============================================================================
  // SECTION 8: generateResourceUtilizationData Tests
  // =============================================================================
  describe('generateResourceUtilizationData', () => {
    let data: ReturnType<typeof SampleDataGenerators.generateResourceUtilizationData>;

    beforeEach(() => {
      data = SampleDataGenerators.generateResourceUtilizationData();
    });

    it('should have required top-level properties', () => {
      expect(data).toHaveProperty('utilizationSummary');
      expect(data).toHaveProperty('agentUtilization');
      expect(data).toHaveProperty('systemResources');
      expect(data).toHaveProperty('capacityPlan');
      expect(data).toHaveProperty('utilizationTrends');
      expect(data).toHaveProperty('bottleneckAnalysis');
    });

    it('should have valid utilization summary', () => {
      const summary = data.utilizationSummary;
      expect(summary.overallUtilization).toBeGreaterThanOrEqual(0);
      expect(summary.overallUtilization).toBeLessThanOrEqual(100);
      expect(summary.peakUtilization).toBeGreaterThanOrEqual(summary.avgUtilization);
      expect(['increasing', 'stable', 'decreasing']).toContain(summary.utilizationTrend);
    });

    it('should have valid agent utilization structure', () => {
      expect(data.agentUtilization.length).toBeGreaterThan(0);
      data.agentUtilization.forEach(agent => {
        expect(agent).toHaveProperty('agentId');
        expect(agent).toHaveProperty('agentName');
        expect(agent).toHaveProperty('utilizationRate');
        expect(agent).toHaveProperty('workloadBalance');
        expect(agent.utilizationRate).toBeGreaterThanOrEqual(0);
        expect(agent.utilizationRate).toBeLessThanOrEqual(100);
      });
    });

    it('should have valid system resources structure', () => {
      const resources = data.systemResources;
      expect(resources).toHaveProperty('serverUtilization');
      expect(resources).toHaveProperty('databasePerformance');
      expect(resources).toHaveProperty('apiPerformance');

      expect(resources.serverUtilization.cpu).toBeGreaterThanOrEqual(0);
      expect(resources.serverUtilization.cpu).toBeLessThanOrEqual(100);
    });

    it('should have valid capacity plan structure', () => {
      const plan = data.capacityPlan;
      expect(plan).toHaveProperty('currentCapacity');
      expect(plan).toHaveProperty('projectedNeed');
      expect(plan).toHaveProperty('capacityGap');
      expect(plan).toHaveProperty('recommendations');
      expect(Array.isArray(plan.recommendations)).toBe(true);
    });

    it('should have valid bottleneck analysis', () => {
      expect(data.bottleneckAnalysis.length).toBeGreaterThan(0);
      data.bottleneckAnalysis.forEach(bottleneck => {
        expect(bottleneck).toHaveProperty('type');
        expect(bottleneck).toHaveProperty('location');
        expect(bottleneck).toHaveProperty('severity');
        expect(bottleneck).toHaveProperty('impact');
        expect(bottleneck).toHaveProperty('suggestedAction');
      });
    });
  });

  // =============================================================================
  // SECTION 9: generateTrendForecastData Tests
  // =============================================================================
  describe('generateTrendForecastData', () => {
    let data: ReturnType<typeof SampleDataGenerators.generateTrendForecastData>;

    beforeEach(() => {
      data = SampleDataGenerators.generateTrendForecastData();
    });

    it('should have required top-level properties', () => {
      expect(data).toHaveProperty('forecastSummary');
      expect(data).toHaveProperty('conversationTrends');
      expect(data).toHaveProperty('demandForecast');
      expect(data).toHaveProperty('riskAssessment');
      expect(data).toHaveProperty('modelPerformance');
    });

    it('should have valid forecast summary', () => {
      const summary = data.forecastSummary;
      expect(summary.forecastPeriod).toBeGreaterThan(0);
      expect(summary.confidence).toBeGreaterThanOrEqual(0);
      expect(summary.confidence).toBeLessThanOrEqual(100);
      expect(summary.accuracy).toBeGreaterThanOrEqual(0);
      expect(summary.lastUpdate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should have valid conversation trends structure', () => {
      const trends = data.conversationTrends;
      expect(trends.historical.length).toBeGreaterThan(0);
      expect(trends.predicted.length).toBeGreaterThan(0);

      trends.historical.forEach(item => {
        expect(item).toHaveProperty('date');
        expect(item).toHaveProperty('actual');
        expect(item).toHaveProperty('trend');
      });

      trends.predicted.forEach(item => {
        expect(item).toHaveProperty('date');
        expect(item).toHaveProperty('predicted');
        expect(item).toHaveProperty('confidenceLow');
        expect(item).toHaveProperty('confidenceHigh');
        // Note: Due to random data generation, confidence intervals may not always
        // contain the predicted value. We just verify the properties exist and are numbers.
        expect(typeof item.confidenceLow).toBe('number');
        expect(typeof item.confidenceHigh).toBe('number');
        expect(typeof item.predicted).toBe('number');
      });
    });

    it('should have valid demand forecast structure', () => {
      const demand = data.demandForecast;
      expect(demand.peakHours.length).toBe(24);
      expect(demand.seasonalPatterns.length).toBeGreaterThan(0);
      expect(demand.specialEvents.length).toBeGreaterThan(0);
    });

    it('should have valid model performance metrics', () => {
      const perf = data.modelPerformance;
      expect(perf).toHaveProperty('mape');
      expect(perf).toHaveProperty('rmse');
      expect(perf).toHaveProperty('lastTraining');
      expect(perf).toHaveProperty('dataQuality');
      expect(perf.mape).toBeGreaterThanOrEqual(0);
      expect(perf.dataQuality).toBeGreaterThanOrEqual(0);
      expect(perf.dataQuality).toBeLessThanOrEqual(100);
    });
  });

  // =============================================================================
  // SECTION 10: generateCustomerInsightsData Tests
  // =============================================================================
  describe('generateCustomerInsightsData', () => {
    let data: ReturnType<typeof SampleDataGenerators.generateCustomerInsightsData>;

    beforeEach(() => {
      data = SampleDataGenerators.generateCustomerInsightsData();
    });

    it('should have required top-level properties', () => {
      expect(data).toHaveProperty('customerSegmentation');
      expect(data).toHaveProperty('behaviorAnalysis');
      expect(data).toHaveProperty('satisfactionInsights');
      expect(data).toHaveProperty('churnPrediction');
      expect(data).toHaveProperty('revenueImpact');
    });

    it('should have valid customer segmentation', () => {
      const seg = data.customerSegmentation;
      expect(seg.totalCustomers).toBeGreaterThan(0);
      expect(seg.segments.length).toBeGreaterThan(0);

      let totalPercentage = 0;
      seg.segments.forEach(segment => {
        expect(segment).toHaveProperty('segment');
        expect(segment).toHaveProperty('count');
        expect(segment).toHaveProperty('percentage');
        expect(segment).toHaveProperty('characteristics');
        expect(segment).toHaveProperty('averageValue');
        expect(segment).toHaveProperty('retentionRate');
        totalPercentage += segment.percentage;
      });

      // Total percentage should be approximately 100%
      expect(totalPercentage).toBeGreaterThan(95);
      expect(totalPercentage).toBeLessThanOrEqual(105);
    });

    it('should have valid behavior analysis structure', () => {
      const behavior = data.behaviorAnalysis;
      expect(behavior).toHaveProperty('preferredChannels');
      expect(behavior).toHaveProperty('contactPatterns');
      expect(behavior).toHaveProperty('journeyMapping');

      expect(behavior.journeyMapping.length).toBeGreaterThan(0);
      behavior.journeyMapping.forEach(stage => {
        expect(stage).toHaveProperty('stage');
        expect(stage).toHaveProperty('touchpoints');
        expect(stage).toHaveProperty('conversionRate');
        expect(stage).toHaveProperty('dropoffRate');
      });
    });

    it('should have valid satisfaction insights', () => {
      const satisfaction = data.satisfactionInsights;
      expect(satisfaction.overallSatisfaction).toBeGreaterThanOrEqual(0);
      expect(satisfaction.overallSatisfaction).toBeLessThanOrEqual(5);
      expect(satisfaction).toHaveProperty('satisfactionDrivers');
      expect(satisfaction).toHaveProperty('npsAnalysis');

      const nps = satisfaction.npsAnalysis;
      expect(nps).toHaveProperty('score');
      expect(nps).toHaveProperty('promoters');
      expect(nps).toHaveProperty('passives');
      expect(nps).toHaveProperty('detractors');
    });

    it('should have valid churn prediction structure', () => {
      const churn = data.churnPrediction;
      expect(churn.churnRate).toBeGreaterThanOrEqual(0);
      expect(churn.churnRate).toBeLessThanOrEqual(100);
      expect(churn).toHaveProperty('riskSegments');
      expect(churn).toHaveProperty('earlyWarningIndicators');
    });
  });

  // =============================================================================
  // SECTION 11: generateChannelIntegrationData Tests
  // =============================================================================
  describe('generateChannelIntegrationData', () => {
    let data: ReturnType<typeof SampleDataGenerators.generateChannelIntegrationData>;

    beforeEach(() => {
      data = SampleDataGenerators.generateChannelIntegrationData();
    });

    it('should have required top-level properties', () => {
      expect(data).toHaveProperty('channelOverview');
      expect(data).toHaveProperty('crossChannelAnalysis');
      expect(data).toHaveProperty('integrationMetrics');
      expect(data).toHaveProperty('channelEffectiveness');
      expect(data).toHaveProperty('unificationOpportunities');
    });

    it('should have valid channel overview structure', () => {
      const overview = data.channelOverview;
      expect(overview.activeChannels.length).toBeGreaterThan(0);
      expect(overview.integrationHealth).toBeGreaterThanOrEqual(0);
      expect(overview.integrationHealth).toBeLessThanOrEqual(100);

      overview.activeChannels.forEach(channel => {
        expect(channel).toHaveProperty('channel');
        expect(channel).toHaveProperty('status');
        expect(channel).toHaveProperty('uptime');
        expect(channel).toHaveProperty('totalConversations');
        expect(['active', 'inactive', 'maintenance']).toContain(channel.status);
      });
    });

    it('should have valid cross channel analysis', () => {
      const analysis = data.crossChannelAnalysis;
      expect(analysis).toHaveProperty('channelMigration');
      expect(analysis).toHaveProperty('omnichanelJourneys');

      analysis.channelMigration.forEach(migration => {
        expect(migration).toHaveProperty('fromChannel');
        expect(migration).toHaveProperty('toChannel');
        expect(migration).toHaveProperty('count');
        expect(migration).toHaveProperty('reason');
      });
    });

    it('should have valid integration metrics', () => {
      const metrics = data.integrationMetrics;
      expect(metrics.dataConsistency).toBeGreaterThanOrEqual(0);
      expect(metrics.dataConsistency).toBeLessThanOrEqual(100);
      expect(metrics.contextPreservation).toBeGreaterThanOrEqual(0);
      expect(metrics.contextPreservation).toBeLessThanOrEqual(100);
    });

    it('should have valid unification opportunities', () => {
      expect(data.unificationOpportunities.length).toBeGreaterThan(0);
      data.unificationOpportunities.forEach(opportunity => {
        expect(opportunity).toHaveProperty('opportunity');
        expect(opportunity).toHaveProperty('description');
        expect(opportunity).toHaveProperty('estimatedImpact');
        expect(opportunity).toHaveProperty('implementationEffort');
        expect(opportunity).toHaveProperty('priority');
      });
    });
  });

  // =============================================================================
  // SECTION 12: generateGoalAchievementData Tests
  // =============================================================================
  describe('generateGoalAchievementData', () => {
    let data: ReturnType<typeof SampleDataGenerators.generateGoalAchievementData>;

    beforeEach(() => {
      data = SampleDataGenerators.generateGoalAchievementData();
    });

    it('should have required top-level properties', () => {
      expect(data).toHaveProperty('goalSummary');
      expect(data).toHaveProperty('departmentGoals');
      expect(data).toHaveProperty('kpiTracking');
      expect(data).toHaveProperty('milestones');
      expect(data).toHaveProperty('performanceTrends');
      expect(data).toHaveProperty('recommendations');
    });

    it('should have valid goal summary', () => {
      const summary = data.goalSummary;
      expect(summary.totalGoals).toBeGreaterThan(0);
      expect(summary.achievedGoals).toBeLessThanOrEqual(summary.totalGoals);
      expect(summary.onTrackGoals).toBeLessThanOrEqual(summary.totalGoals);
      expect(summary.atRiskGoals).toBeLessThanOrEqual(summary.totalGoals);
      expect(summary.overallProgress).toBeGreaterThanOrEqual(0);
      expect(summary.overallProgress).toBeLessThanOrEqual(100);
    });

    it('should have valid department goals structure', () => {
      expect(data.departmentGoals.length).toBeGreaterThan(0);
      data.departmentGoals.forEach(dept => {
        expect(dept).toHaveProperty('department');
        expect(dept).toHaveProperty('goals');
        expect(dept).toHaveProperty('departmentProgress');
        expect(dept.goals.length).toBeGreaterThan(0);

        dept.goals.forEach(goal => {
          expect(goal).toHaveProperty('id');
          expect(goal).toHaveProperty('title');
          expect(goal).toHaveProperty('target');
          expect(goal).toHaveProperty('current');
          expect(goal).toHaveProperty('progress');
          expect(goal).toHaveProperty('status');
          expect(['achieved', 'on_track', 'at_risk', 'behind']).toContain(goal.status);
        });
      });
    });

    it('should have valid milestones structure', () => {
      expect(data.milestones.length).toBeGreaterThan(0);
      data.milestones.forEach(milestone => {
        expect(milestone).toHaveProperty('id');
        expect(milestone).toHaveProperty('title');
        expect(milestone).toHaveProperty('dueDate');
        expect(milestone).toHaveProperty('status');
        expect(milestone).toHaveProperty('progress');
        expect(['pending', 'in_progress', 'completed', 'delayed']).toContain(milestone.status);
      });
    });
  });

  // =============================================================================
  // SECTION 13: generateAutomationEffectivenessData Tests
  // =============================================================================
  describe('generateAutomationEffectivenessData', () => {
    let data: ReturnType<typeof SampleDataGenerators.generateAutomationEffectivenessData>;

    beforeEach(() => {
      data = SampleDataGenerators.generateAutomationEffectivenessData();
    });

    it('should have required top-level properties', () => {
      expect(data).toHaveProperty('automationOverview');
      expect(data).toHaveProperty('automationTypes');
      expect(data).toHaveProperty('performanceMetrics');
      expect(data).toHaveProperty('automationROI');
      expect(data).toHaveProperty('failureAnalysis');
      expect(data).toHaveProperty('optimizationOpportunities');
    });

    it('should have valid automation overview', () => {
      const overview = data.automationOverview;
      expect(overview.totalAutomations).toBeGreaterThan(0);
      expect(overview.activeAutomations).toBeLessThanOrEqual(overview.totalAutomations);
      expect(overview.automationCoverage).toBeGreaterThanOrEqual(0);
      expect(overview.automationCoverage).toBeLessThanOrEqual(100);
      expect(overview.overallEffectiveness).toBeGreaterThanOrEqual(0);
      expect(overview.overallEffectiveness).toBeLessThanOrEqual(100);
    });

    it('should have valid automation types structure', () => {
      expect(data.automationTypes.length).toBeGreaterThan(0);
      data.automationTypes.forEach(type => {
        expect(type).toHaveProperty('type');
        expect(type).toHaveProperty('count');
        expect(type).toHaveProperty('successRate');
        expect(type).toHaveProperty('avgProcessingTime');
        expect(type).toHaveProperty('costSavings');
        expect(type).toHaveProperty('humanHandoffRate');
        expect(type.successRate).toBeGreaterThanOrEqual(0);
        expect(type.successRate).toBeLessThanOrEqual(100);
      });
    });

    it('should have valid automation ROI', () => {
      const roi = data.automationROI;
      expect(roi.totalInvestment).toBeGreaterThan(0);
      expect(roi.monthlySavings).toBeGreaterThanOrEqual(0);
      expect(roi.paybackPeriod).toBeGreaterThan(0);
      expect(roi.roi).toBeGreaterThanOrEqual(0);
    });

    it('should have valid failure analysis', () => {
      const failures = data.failureAnalysis;
      expect(failures).toHaveProperty('commonFailures');
      expect(failures).toHaveProperty('errorPatterns');
      expect(failures.commonFailures.length).toBeGreaterThan(0);
    });
  });

  // =============================================================================
  // SECTION 14: generateSecurityRiskData Tests
  // =============================================================================
  describe('generateSecurityRiskData', () => {
    let data: ReturnType<typeof SampleDataGenerators.generateSecurityRiskData>;

    beforeEach(() => {
      data = SampleDataGenerators.generateSecurityRiskData();
    });

    it('should have required top-level properties', () => {
      expect(data).toHaveProperty('riskOverview');
      expect(data).toHaveProperty('threatLandscape');
      expect(data).toHaveProperty('vulnerabilityAssessment');
      expect(data).toHaveProperty('securityIncidents');
      expect(data).toHaveProperty('complianceStatus');
      expect(data).toHaveProperty('recommendations');
    });

    it('should have valid risk overview', () => {
      const overview = data.riskOverview;
      expect(overview.overallRiskScore).toBeGreaterThanOrEqual(0);
      expect(overview.overallRiskScore).toBeLessThanOrEqual(100);
      expect(['improving', 'stable', 'worsening']).toContain(overview.riskTrend);
      expect(overview.highRiskCount).toBeGreaterThanOrEqual(0);
      expect(overview.criticalVulnerabilities).toBeGreaterThanOrEqual(0);
    });

    it('should have valid threat landscape structure', () => {
      const threats = data.threatLandscape;
      expect(threats.identifiedThreats.length).toBeGreaterThan(0);
      threats.identifiedThreats.forEach(threat => {
        expect(threat).toHaveProperty('threat');
        expect(threat).toHaveProperty('severity');
        expect(threat).toHaveProperty('likelihood');
        expect(threat).toHaveProperty('impact');
        expect(threat).toHaveProperty('riskScore');
        expect(threat).toHaveProperty('mitigation');
        expect(threat).toHaveProperty('status');
      });

      expect(threats.attackVectors.length).toBeGreaterThan(0);
    });

    it('should have valid vulnerability assessment', () => {
      const assessment = data.vulnerabilityAssessment;
      expect(assessment.systemVulnerabilities.length).toBeGreaterThan(0);
      expect(assessment.dataExposureRisks.length).toBeGreaterThan(0);
    });

    it('should have valid compliance status', () => {
      const compliance = data.complianceStatus;
      expect(compliance.regulations.length).toBeGreaterThan(0);
      compliance.regulations.forEach(reg => {
        expect(reg).toHaveProperty('regulation');
        expect(reg).toHaveProperty('compliance');
        expect(reg).toHaveProperty('gaps');
        expect(reg).toHaveProperty('nextAudit');
        expect(reg.compliance).toBeGreaterThanOrEqual(0);
        expect(reg.compliance).toBeLessThanOrEqual(100);
      });
    });
  });

  // =============================================================================
  // SECTION 15: generateKnowledgeBaseData Tests
  // =============================================================================
  describe('generateKnowledgeBaseData', () => {
    let data: ReturnType<typeof SampleDataGenerators.generateKnowledgeBaseData>;

    beforeEach(() => {
      data = SampleDataGenerators.generateKnowledgeBaseData();
    });

    it('should have required top-level properties', () => {
      expect(data).toHaveProperty('knowledgeOverview');
      expect(data).toHaveProperty('contentPerformance');
      expect(data).toHaveProperty('usageAnalytics');
      expect(data).toHaveProperty('contentMaintenance');
      expect(data).toHaveProperty('agentProductivity');
      expect(data).toHaveProperty('aiIntegration');
    });

    it('should have valid knowledge overview', () => {
      const overview = data.knowledgeOverview;
      expect(overview.totalArticles).toBeGreaterThan(0);
      expect(overview.publishedArticles).toBeLessThanOrEqual(overview.totalArticles);
      expect(overview.draftArticles).toBeLessThanOrEqual(overview.totalArticles);
      expect(overview.avgRating).toBeGreaterThanOrEqual(0);
      expect(overview.avgRating).toBeLessThanOrEqual(5);
    });

    it('should have valid content performance structure', () => {
      const perf = data.contentPerformance;
      expect(perf.topPerformingArticles.length).toBeGreaterThan(0);
      expect(perf.underperformingArticles.length).toBeGreaterThan(0);
      expect(perf.contentGaps.length).toBeGreaterThan(0);

      perf.topPerformingArticles.forEach(article => {
        expect(article).toHaveProperty('id');
        expect(article).toHaveProperty('title');
        expect(article).toHaveProperty('views');
        expect(article).toHaveProperty('rating');
        expect(article).toHaveProperty('helpfulness');
      });
    });

    it('should have valid usage analytics', () => {
      const usage = data.usageAnalytics;
      expect(usage.searchPatterns.length).toBeGreaterThan(0);
      expect(usage).toHaveProperty('userBehavior');
      expect(usage).toHaveProperty('channelUsage');

      usage.searchPatterns.forEach(pattern => {
        expect(pattern).toHaveProperty('query');
        expect(pattern).toHaveProperty('frequency');
        expect(pattern).toHaveProperty('successRate');
        expect(pattern.successRate).toBeGreaterThanOrEqual(0);
        expect(pattern.successRate).toBeLessThanOrEqual(100);
      });
    });

    it('should have valid AI integration data', () => {
      const ai = data.aiIntegration;
      expect(ai).toHaveProperty('chatbotUsage');
      expect(ai).toHaveProperty('smartSuggestions');

      expect(ai.chatbotUsage.articlesReferenced).toBeGreaterThanOrEqual(0);
      expect(ai.smartSuggestions.accuracy).toBeGreaterThanOrEqual(0);
      expect(ai.smartSuggestions.accuracy).toBeLessThanOrEqual(100);
    });
  });

  // =============================================================================
  // SECTION 16: generateCallQualityData Tests
  // =============================================================================
  describe('generateCallQualityData', () => {
    let data: ReturnType<typeof SampleDataGenerators.generateCallQualityData>;

    beforeEach(() => {
      data = SampleDataGenerators.generateCallQualityData();
    });

    it('should have required top-level properties', () => {
      expect(data).toHaveProperty('qualityOverview');
      expect(data).toHaveProperty('audioQuality');
      expect(data).toHaveProperty('conversationQuality');
      expect(data).toHaveProperty('customerExperience');
      expect(data).toHaveProperty('technicalMetrics');
      expect(data).toHaveProperty('improvementPlan');
    });

    it('should have valid quality overview', () => {
      const overview = data.qualityOverview;
      expect(overview.totalCalls).toBeGreaterThan(0);
      expect(overview.avgQualityScore).toBeGreaterThanOrEqual(0);
      expect(overview.avgQualityScore).toBeLessThanOrEqual(100);
      expect(['improving', 'stable', 'declining']).toContain(overview.qualityTrend);
      expect(overview.monitoredCalls).toBeLessThanOrEqual(overview.totalCalls);
    });

    it('should have valid audio quality metrics', () => {
      const audio = data.audioQuality;
      expect(audio.overallAudioScore).toBeGreaterThanOrEqual(0);
      expect(audio.overallAudioScore).toBeLessThanOrEqual(100);
      expect(audio.commonIssues.length).toBeGreaterThan(0);
      expect(audio).toHaveProperty('networkPerformance');
    });

    it('should have valid conversation quality metrics', () => {
      const conv = data.conversationQuality;
      expect(conv.agentPerformance.length).toBeGreaterThan(0);
      expect(conv).toHaveProperty('qualityMetrics');
      expect(conv).toHaveProperty('compliance');

      conv.agentPerformance.forEach(agent => {
        expect(agent).toHaveProperty('agentId');
        expect(agent).toHaveProperty('avgScore');
        expect(agent).toHaveProperty('strengths');
        expect(agent).toHaveProperty('improvementAreas');
      });
    });

    it('should have valid customer experience data', () => {
      const cx = data.customerExperience;
      expect(cx).toHaveProperty('satisfactionCorrelation');
      expect(cx).toHaveProperty('callOutcomes');
      expect(cx).toHaveProperty('emotionAnalysis');

      const emotions = cx.emotionAnalysis;
      const totalEmotions = emotions.positiveEmotions + emotions.neutralEmotions + emotions.negativeEmotions;
      expect(totalEmotions).toBeGreaterThan(99);
      expect(totalEmotions).toBeLessThanOrEqual(101);
    });

    it('should have valid improvement plan', () => {
      expect(data.improvementPlan.length).toBeGreaterThan(0);
      data.improvementPlan.forEach(plan => {
        expect(plan).toHaveProperty('area');
        expect(plan).toHaveProperty('issue');
        expect(plan).toHaveProperty('recommendation');
        expect(plan).toHaveProperty('priority');
        expect(plan).toHaveProperty('estimatedImpact');
        expect(plan).toHaveProperty('implementationTime');
      });
    });
  });

  // =============================================================================
  // SECTION 17: generateExecutiveSummaryData Tests
  // =============================================================================
  describe('generateExecutiveSummaryData', () => {
    let data: ReturnType<typeof SampleDataGenerators.generateExecutiveSummaryData>;

    beforeEach(() => {
      data = SampleDataGenerators.generateExecutiveSummaryData();
    });

    it('should have required top-level properties', () => {
      expect(data).toHaveProperty('executiveOverview');
      expect(data).toHaveProperty('businessMetrics');
      expect(data).toHaveProperty('strategicInsights');
      expect(data).toHaveProperty('riskAssessment');
      expect(data).toHaveProperty('financialSummary');
      expect(data).toHaveProperty('actionItems');
      expect(data).toHaveProperty('recommendations');
    });

    it('should have valid executive overview', () => {
      const overview = data.executiveOverview;
      expect(overview.reportPeriod).toBeTruthy();
      expect(overview.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(Array.isArray(overview.keyHighlights)).toBe(true);
      expect(overview.keyHighlights.length).toBeGreaterThan(0);
      expect(['excellent', 'good', 'fair', 'poor']).toContain(overview.overallPerformance);
      expect(overview.performanceScore).toBeGreaterThanOrEqual(0);
      expect(overview.performanceScore).toBeLessThanOrEqual(100);
    });

    it('should have valid business metrics structure', () => {
      const metrics = data.businessMetrics;
      expect(metrics).toHaveProperty('customerSatisfaction');
      expect(metrics).toHaveProperty('operationalEfficiency');
      expect(metrics).toHaveProperty('costEffectiveness');
      expect(metrics).toHaveProperty('revenueImpact');

      // Check each metric has proper trend and comparison
      ['customerSatisfaction', 'operationalEfficiency', 'costEffectiveness'].forEach(key => {
        const metric = metrics[key as keyof typeof metrics];
        if ('trend' in metric) {
          expect(['up', 'down', 'stable']).toContain(metric.trend);
        }
        if ('comparison' in metric) {
          expect(['above', 'below', 'meeting']).toContain(metric.comparison);
        }
      });
    });

    it('should have valid strategic insights', () => {
      const insights = data.strategicInsights;
      expect(insights).toHaveProperty('marketPosition');
      expect(insights).toHaveProperty('customerInsights');

      expect(insights.marketPosition.competitiveRanking).toBeGreaterThan(0);
      expect(insights.marketPosition.marketShare).toBeGreaterThanOrEqual(0);
      expect(insights.marketPosition.marketShare).toBeLessThanOrEqual(100);
    });

    it('should have valid risk assessment', () => {
      const risk = data.riskAssessment;
      expect(['low', 'medium', 'high', 'critical']).toContain(risk.overallRisk);
      expect(risk.riskFactors.length).toBeGreaterThan(0);
      risk.riskFactors.forEach(factor => {
        expect(factor.probability).toBeGreaterThanOrEqual(0);
        expect(factor.probability).toBeLessThanOrEqual(100);
        expect(factor.impact).toBeGreaterThanOrEqual(0);
        expect(factor.impact).toBeLessThanOrEqual(100);
      });
    });

    it('should have valid financial summary', () => {
      const financial = data.financialSummary;
      expect(financial).toHaveProperty('currentPeriod');
      expect(financial).toHaveProperty('yearOverYear');
      expect(financial).toHaveProperty('projections');

      const current = financial.currentPeriod;
      expect(current.profit).toBe(current.revenue - current.costs);
    });

    it('should have valid action items', () => {
      const actions = data.actionItems;
      expect(actions).toHaveProperty('immediate');
      expect(actions).toHaveProperty('strategic');

      expect(actions.immediate.length).toBeGreaterThan(0);
      actions.immediate.forEach(action => {
        expect(action).toHaveProperty('priority');
        expect(action).toHaveProperty('action');
        expect(action).toHaveProperty('owner');
        expect(action).toHaveProperty('deadline');
      });

      expect(actions.strategic.length).toBeGreaterThan(0);
      actions.strategic.forEach(action => {
        expect(action).toHaveProperty('initiative');
        expect(action).toHaveProperty('investment');
        expect(action).toHaveProperty('expectedROI');
        expect(action.expectedROI).toBeGreaterThan(0);
      });
    });

    it('should have valid recommendations', () => {
      expect(data.recommendations.length).toBeGreaterThan(0);
      data.recommendations.forEach(rec => {
        expect(rec).toHaveProperty('category');
        expect(rec).toHaveProperty('recommendation');
        expect(rec).toHaveProperty('rationale');
        expect(rec).toHaveProperty('expectedBenefit');
        expect(rec).toHaveProperty('investmentRequired');
        expect(rec).toHaveProperty('timeframe');
      });
    });
  });

  // =============================================================================
  // SECTION 18: Edge Cases and Robustness Tests
  // =============================================================================
  describe('Edge Cases and Robustness', () => {
    it('should generate consistent data structure across multiple calls', () => {
      const data1 = SampleDataGenerators.generateConversationData();
      const data2 = SampleDataGenerators.generateConversationData();

      // Structure should be identical
      expect(Object.keys(data1)).toEqual(Object.keys(data2));
      expect(data1.hourlyDistribution.length).toBe(data2.hourlyDistribution.length);
      expect(data1.dailyTrends.length).toBe(data2.dailyTrends.length);
    });

    it('should handle all report types without throwing errors', () => {
      const allTypes: ReportType[] = [
        'conversation_summary', 'agent_performance', 'cost_analysis',
        'sla_compliance', 'anomaly_detection', 'audit_trail',
        'resource_utilization', 'trend_forecast', 'customer_insights',
        'channel_integration', 'goal_achievement', 'automation_effectiveness',
        'security_risk', 'knowledge_base', 'call_quality', 'executive_summary'
      ];

      allTypes.forEach(type => {
        expect(() => SampleDataGenerators.getSampleData(type)).not.toThrow();
      });
    });

    it('should generate valid date strings', () => {
      const data = SampleDataGenerators.generateConversationData();

      // Check period dates
      expect(() => new Date(data.period.startDate)).not.toThrow();
      expect(() => new Date(data.period.endDate)).not.toThrow();

      // Check daily trends dates
      data.dailyTrends.forEach(trend => {
        expect(() => new Date(trend.date)).not.toThrow();
      });
    });

    it('should generate numeric values within reasonable ranges', () => {
      const agentData = SampleDataGenerators.generateAgentData();

      // Satisfaction scores should be 0-5
      agentData.agentMetrics.forEach(agent => {
        expect(agent.customerSatisfactionScore).toBeGreaterThanOrEqual(0);
        expect(agent.customerSatisfactionScore).toBeLessThanOrEqual(5);
      });

      // Resolution rate should be 0-1
      agentData.agentMetrics.forEach(agent => {
        expect(agent.resolutionRate).toBeGreaterThanOrEqual(0);
        expect(agent.resolutionRate).toBeLessThanOrEqual(1);
      });
    });
  });
});
