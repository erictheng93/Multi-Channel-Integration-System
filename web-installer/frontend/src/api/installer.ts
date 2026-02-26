/**
 * API Client for Web Installer Backend
 *
 * Handles all HTTP communication with the Cloudflare Worker backend
 */

import type {
  OAuthAuthorizeResponse,
  OAuthCallbackRequest,
  OAuthCallbackResponse,
  StartDeploymentRequest,
  StartDeploymentResponse,
  DeploymentStatusResponse
} from '@/types';

// ========================================
// CONFIGURATION
// ========================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''; // Use proxy in development if empty

// ========================================
// HELPER FUNCTIONS
// ========================================

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: response.statusText
    }));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

// ========================================
// AUTH API (API Token)
// ========================================

export const authAPI = {
  /**
   * Verify an API Token and get account info
   * POST /auth/token
   */
  async verifyToken(request: { apiToken: string; accountId: string }): Promise<{
    success: boolean;
    accountId: string;
    accountName: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    return handleResponse(response);
  }
};

// ========================================
// OAUTH API
// ========================================

export const oauthAPI = {
  /**
   * Initiate OAuth authorization flow
   * GET /oauth/authorize?redirect_uri=...
   */
  async authorize(redirectUri: string): Promise<OAuthAuthorizeResponse> {
    const url = new URL(`${API_BASE_URL}/oauth/authorize`);
    url.searchParams.append('redirect_uri', redirectUri);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return handleResponse<OAuthAuthorizeResponse>(response);
  },

  /**
   * Exchange authorization code for access token
   * POST /oauth/callback
   */
  async exchangeToken(request: OAuthCallbackRequest): Promise<OAuthCallbackResponse> {
    const response = await fetch(`${API_BASE_URL}/oauth/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    return handleResponse<OAuthCallbackResponse>(response);
  }
};

// ========================================
// DEPLOYMENT API
// ========================================

export const deploymentAPI = {
  /**
   * Start a new deployment
   * POST /deployment/start
   */
  async startDeployment(request: StartDeploymentRequest): Promise<StartDeploymentResponse> {
    const response = await fetch(`${API_BASE_URL}/deployment/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    return handleResponse<StartDeploymentResponse>(response);
  },

  /**
   * Get deployment status
   * GET /deployment/:projectName/status
   */
  async getDeploymentStatus(projectName: string): Promise<DeploymentStatusResponse> {
    const response = await fetch(`${API_BASE_URL}/deployment/${projectName}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return handleResponse<DeploymentStatusResponse>(response);
  },

  /**
   * Cancel deployment
   * POST /deployment/:projectName/cancel
   */
  async cancelDeployment(projectName: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/deployment/${projectName}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return handleResponse<{ success: boolean; message: string }>(response);
  },

};

// ========================================
// HEALTH API
// ========================================

export const healthAPI = {
  /**
   * Health check endpoint
   * GET /health
   */
  async check(): Promise<{ status: string; service: string; version: string; timestamp: number }> {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return handleResponse(response);
  }
};
