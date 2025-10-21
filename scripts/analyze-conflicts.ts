#!/usr/bin/env tsx
// Conflict Analysis Script - 分析衝突並分類模組
// 用於決定哪些模組用智能註冊器，哪些需要手動分析

import { readFileSync } from 'fs';

interface ConflictInfo {
  module: string;
  path1: string;
  path2: string;
  file: string;
  lines: string[];
}

interface ModuleStats {
  module: string;
  conflictCount: number;
  routeCount: number;
  complexity: 'low' | 'medium' | 'high';
  businessCriticality: 'low' | 'medium' | 'high';
  recommendation: 'smart-registry' | 'manual-analysis' | 'hybrid';
  conflicts: ConflictInfo[];
}

// 從報告文件中提取衝突
function extractConflicts(reportPath: string): ConflictInfo[] {
  const content = readFileSync(reportPath, 'utf-8');
  const lines = content.split('\n');
  const conflicts: ConflictInfo[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 檢測衝突標記
    if (line.includes('⚠️') && line.includes('may intercept')) {
      // 提取路徑
      const pathMatch = line.match(/"([^"]+)" may intercept "([^"]+)"/);
      if (!pathMatch) continue;

      const path1 = pathMatch[1];
      const path2 = pathMatch[2];

      // 提取模組
      const moduleMatch = lines[i + 1]?.match(/📦 Module: (.+)/);
      if (!moduleMatch) continue;

      const module = moduleMatch[1].trim();

      // 提取文件路徑
      const fileMatch = lines[i + 3]?.match(/📍 (.+\.ts):\d+/);
      const file = fileMatch ? fileMatch[1] : '';

      conflicts.push({
        module,
        path1,
        path2,
        file,
        lines: [lines[i + 3] || '', lines[i + 4] || '']
      });
    }
  }

  return conflicts;
}

// 統計模組衝突
function groupByModule(conflicts: ConflictInfo[]): Map<string, ConflictInfo[]> {
  const grouped = new Map<string, ConflictInfo[]>();

  conflicts.forEach(conflict => {
    const existing = grouped.get(conflict.module) || [];
    existing.push(conflict);
    grouped.set(conflict.module, existing);
  });

  return grouped;
}

// 評估模組複雜度
function evaluateComplexity(moduleConflicts: ConflictInfo[]): 'low' | 'medium' | 'high' {
  const conflictCount = moduleConflicts.length;

  if (conflictCount < 5) return 'low';
  if (conflictCount < 15) return 'medium';
  return 'high';
}

// 評估業務重要性（基於模組名稱）
function evaluateBusinessCriticality(moduleName: string): 'low' | 'medium' | 'high' {
  // 關鍵業務模組
  const criticalModules = [
    'modules/auth',
    'modules/agents',
    'modules/payment',
    'handlers/auth-main',
    'modules/customer'
  ];

  // 重要模組
  const importantModules = [
    'modules/teams',
    'modules/conversations',
    'handlers/messaging-main',
    'modules/qrcode'
  ];

  if (criticalModules.some(m => moduleName.includes(m))) return 'high';
  if (importantModules.some(m => moduleName.includes(m))) return 'medium';
  return 'low';
}

// 推薦修復策略
function recommendStrategy(
  conflictCount: number,
  complexity: string,
  criticality: string
): 'smart-registry' | 'manual-analysis' | 'hybrid' {
  // 高複雜度 + 高重要性 → 混合策略
  if (complexity === 'high' && criticality === 'high') {
    return 'hybrid';
  }

  // 高重要性但低衝突 → 手動分析
  if (criticality === 'high' && conflictCount < 5) {
    return 'manual-analysis';
  }

  // 高衝突數量 → 智能註冊器
  if (conflictCount > 10) {
    return 'smart-registry';
  }

  // 默認：智能註冊器
  return 'smart-registry';
}

// 主分析函數
function analyzeConflicts(reportPath: string): ModuleStats[] {
  console.log('🔍 Analyzing route conflicts...\n');

  const conflicts = extractConflicts(reportPath);
  const groupedConflicts = groupByModule(conflicts);

  console.log(`Found ${conflicts.length} total conflicts across ${groupedConflicts.size} modules\n`);

  const moduleStats: ModuleStats[] = [];

  groupedConflicts.forEach((moduleConflicts, moduleName) => {
    const complexity = evaluateComplexity(moduleConflicts);
    const criticality = evaluateBusinessCriticality(moduleName);
    const recommendation = recommendStrategy(
      moduleConflicts.length,
      complexity,
      criticality
    );

    moduleStats.push({
      module: moduleName,
      conflictCount: moduleConflicts.length,
      routeCount: 0, // Will be filled from module distribution
      complexity,
      businessCriticality: criticality,
      recommendation,
      conflicts: moduleConflicts
    });
  });

  // 按衝突數量排序
  moduleStats.sort((a, b) => b.conflictCount - a.conflictCount);

  return moduleStats;
}

// 生成報告
function generateReport(stats: ModuleStats[]): void {
  console.log('═'.repeat(100));
  console.log('📊 MODULE CLASSIFICATION REPORT');
  console.log('═'.repeat(100));
  console.log('');

  // 按策略分組
  const smartRegistry = stats.filter(s => s.recommendation === 'smart-registry');
  const manualAnalysis = stats.filter(s => s.recommendation === 'manual-analysis');
  const hybrid = stats.filter(s => s.recommendation === 'hybrid');

  console.log(`✅ Smart Registry (Option B): ${smartRegistry.length} modules (${smartRegistry.reduce((sum, m) => sum + m.conflictCount, 0)} conflicts)`);
  console.log(`⚠️  Manual Analysis (Option C): ${manualAnalysis.length} modules (${manualAnalysis.reduce((sum, m) => sum + m.conflictCount, 0)} conflicts)`);
  console.log(`🔄 Hybrid Approach: ${hybrid.length} modules (${hybrid.reduce((sum, m) => sum + m.conflictCount, 0)} conflicts)`);
  console.log('');

  // 詳細列表
  console.log('🤖 SMART REGISTRY MODULES (Quick Fix)');
  console.log('─'.repeat(100));
  smartRegistry.forEach(stat => {
    console.log(`  📦 ${stat.module.padEnd(50)} ${stat.conflictCount} conflicts (${stat.complexity} complexity)`);
  });
  console.log('');

  if (hybrid.length > 0) {
    console.log('🔄 HYBRID APPROACH MODULES (Review + Auto)');
    console.log('─'.repeat(100));
    hybrid.forEach(stat => {
      console.log(`  📦 ${stat.module.padEnd(50)} ${stat.conflictCount} conflicts (${stat.criticality} criticality)`);
    });
    console.log('');
  }

  if (manualAnalysis.length > 0) {
    console.log('👁️  MANUAL ANALYSIS MODULES (Critical)');
    console.log('─'.repeat(100));
    manualAnalysis.forEach(stat => {
      console.log(`  📦 ${stat.module.padEnd(50)} ${stat.conflictCount} conflicts (${stat.criticality} criticality)`);
    });
    console.log('');
  }

  console.log('═'.repeat(100));

  // 統計摘要
  const totalConflicts = stats.reduce((sum, s) => sum + s.conflictCount, 0);
  const autoFixableConflicts = smartRegistry.reduce((sum, s) => sum + s.conflictCount, 0);
  const manualConflicts = manualAnalysis.reduce((sum, s) => sum + s.conflictCount, 0);

  console.log('📈 STATISTICS');
  console.log('─'.repeat(100));
  console.log(`Total Conflicts: ${totalConflicts}`);
  console.log(`Auto-fixable (Smart Registry): ${autoFixableConflicts} (${Math.round(autoFixableConflicts / totalConflicts * 100)}%)`);
  console.log(`Manual Review Required: ${manualConflicts} (${Math.round(manualConflicts / totalConflicts * 100)}%)`);
  console.log('');
  console.log(`⏱️  Estimated Time:`);
  console.log(`  - Smart Registry: ${Math.round(smartRegistry.length * 0.25)} hours (15 min/module)`);
  console.log(`  - Manual Analysis: ${Math.round(manualAnalysis.length * 2)} hours (2 hr/module)`);
  console.log(`  - Hybrid: ${Math.round(hybrid.length * 1)} hours (1 hr/module)`);
  console.log(`  - Total: ${Math.round(smartRegistry.length * 0.25 + manualAnalysis.length * 2 + hybrid.length * 1)} hours`);
  console.log('');
  console.log('═'.repeat(100));
}

// 執行分析
try {
  const stats = analyzeConflicts('route-conflicts-full.txt');
  generateReport(stats);

  // 保存結果供腳本使用
  const fs = require('fs');
  fs.writeFileSync(
    'conflict-classification.json',
    JSON.stringify({
      smartRegistry: stats.filter(s => s.recommendation === 'smart-registry').map(s => s.module),
      manualAnalysis: stats.filter(s => s.recommendation === 'manual-analysis').map(s => s.module),
      hybrid: stats.filter(s => s.recommendation === 'hybrid').map(s => s.module),
      allStats: stats
    }, null, 2)
  );

  console.log('✅ Classification saved to conflict-classification.json');

} catch (error) {
  console.error('Error analyzing conflicts:', error);
  process.exit(1);
}
