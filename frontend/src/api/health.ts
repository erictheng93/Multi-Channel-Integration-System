// 健康檢查 API 客戶端
import type { SystemHealth, HealthCheckResult, ComponentHealth } from '@/types/health';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'https://multi-channel.imfinethankyouandyou.com';
const API_BASE_URL = baseURL.endsWith('/api') ? baseURL : `${baseURL}/api`;
const BASE_URL = `${API_BASE_URL}/health`;

export class HealthAPI {
  /**
   * 獲取系統整體健康狀態
   */
  static async getSystemHealth(): Promise<SystemHealth> {
    const response = await fetch(`${BASE_URL}/system`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * 獲取基礎設施健康狀態
   */
  static async getInfrastructureHealth(): Promise<ComponentHealth[]> {
    const response = await fetch(`${BASE_URL}/infrastructure`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Infrastructure health check failed: ${response.status}`);
    }

    const result = await response.json();
    return result.data.components;
  }

  /**
   * 獲取服務層健康狀態
   */
  static async getServicesHealth(): Promise<ComponentHealth[]> {
    const response = await fetch(`${BASE_URL}/services`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Services health check failed: ${response.status}`);
    }

    const result = await response.json();
    return result.data.services;
  }

  /**
   * 獲取健康檢查統計
   */
  static async getHealthStats(): Promise<{
    overview: {
      overallStatus: string;
      totalComponents: number;
      uptime: string;
      lastCheck: string;
    };
    distribution: {
      healthy: { count: number; percentage: number };
      warning: { count: number; percentage: number };
      critical: { count: number; percentage: number };
      unknown: { count: number; percentage: number };
    };
  }> {
    const response = await fetch(`${BASE_URL}/stats`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Health stats failed: ${response.status}`);
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * 運行特定組件的健康檢查
   */
  static async runComponentCheck(component: string): Promise<HealthCheckResult> {
    const response = await fetch(`${BASE_URL}/component/${component}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Component check failed: ${response.status}`);
    }

    const result = await response.json();
    return result.data.check;
  }

  /**
   * 觸發完整健康檢查
   */
  static async runFullHealthCheck(): Promise<SystemHealth> {
    const response = await fetch(`${BASE_URL}/check/all`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Full health check failed: ${response.status}`);
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * 獲取簡單健康狀態 (無需認證)
   */
  static async getBasicHealth(): Promise<{ status: string; timestamp: string }> {
    const response = await fetch(`${BASE_URL}/health`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Basic health check failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 獲取系統狀態 (無需認證)
   */
  static async getSystemStatus(): Promise<SystemHealth> {
    const response = await fetch(`${BASE_URL}/status`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`System status check failed: ${response.status}`);
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * 獲取Prometheus格式的指標
   */
  static async getMetrics(): Promise<string> {
    const response = await fetch(`${BASE_URL}/metrics`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Accept': 'text/plain'
      }
    });

    if (!response.ok) {
      throw new Error(`Metrics retrieval failed: ${response.status}`);
    }

    return response.text();
  }

  /**
   * 格式化健康狀態顯示
   */
  static formatHealthStatus(status: string): string {
    switch (status) {
      case 'healthy': return '健康';
      case 'warning': return '警告';
      case 'critical': return '危險';
      case 'unknown': return '未知';
      default: return status;
    }
  }

  /**
   * 獲取健康狀態圖標
   */
  static getHealthIcon(status: string): string {
    switch (status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'critical': return '❌';
      case 'unknown': return '❓';
      default: return '⚪';
    }
  }

  /**
   * 獲取健康狀態CSS類別
   */
  static getHealthClass(status: string): string {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'critical': return 'text-red-600 bg-red-50';
      case 'unknown': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-500 bg-gray-100';
    }
  }
}

export default HealthAPI;