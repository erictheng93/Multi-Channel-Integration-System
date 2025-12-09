/**
 * Frontend Bundle Service
 *
 * Provides pre-built frontend assets for deployment to Cloudflare Pages
 * The bundle is generated from the main CRM frontend during build
 */

export interface FrontendBundleConfig {
  apiBaseUrl: string;
  wsBaseUrl: string;
  appUrl: string;
  projectName: string;
}

export interface FrontendAsset {
  path: string;
  content: string;
  contentType: string;
}

export class FrontendBundleService {
  /**
   * Get all frontend assets for deployment
   *
   * NOTE: In production, this should return the actual built frontend assets
   * from the main CRM project. For now, it returns a minimal SPA that:
   * 1. Displays a loading page
   * 2. Connects to the backend API
   * 3. Provides basic functionality
   *
   * The actual bundle should be generated using:
   * - npm run build in the frontend directory
   * - Include all compiled assets
   * - Configure API URLs via environment variables
   */
  getBundledAssets(config: FrontendBundleConfig): Map<string, string> {
    const assets = new Map<string, string>();

    // Index HTML
    assets.set('index.html', this.generateIndexHtml(config));

    // _headers file for CORS and caching
    assets.set('_headers', this.generateHeaders());

    // _redirects file for SPA routing
    assets.set('_redirects', this.generateRedirects());

    // Config file for runtime configuration
    assets.set('config.json', JSON.stringify({
      apiBaseUrl: config.apiBaseUrl,
      wsBaseUrl: config.wsBaseUrl,
      appUrl: config.appUrl,
      projectName: config.projectName,
      version: '1.0.0'
    }, null, 2));

    return assets;
  }

  /**
   * Generate the main index.html
   * This is a placeholder that should be replaced with actual built assets
   */
  private generateIndexHtml(config: FrontendBundleConfig): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.projectName} - CRM System</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: white;
      padding: 3rem;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      text-align: center;
      max-width: 500px;
      width: 90%;
    }
    .logo {
      width: 80px;
      height: 80px;
      margin: 0 auto 1.5rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 2rem;
      font-weight: bold;
    }
    h1 {
      color: #1a202c;
      margin-bottom: 0.5rem;
      font-size: 1.5rem;
    }
    .subtitle {
      color: #718096;
      margin-bottom: 2rem;
    }
    .status {
      padding: 1rem;
      background: #f7fafc;
      border-radius: 8px;
      margin-bottom: 1.5rem;
    }
    .status.loading {
      border-left: 4px solid #667eea;
    }
    .status.success {
      border-left: 4px solid #48bb78;
      background: #f0fff4;
    }
    .status.error {
      border-left: 4px solid #f56565;
      background: #fff5f5;
    }
    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid #e2e8f0;
      border-top-color: #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      display: inline-block;
      margin-right: 0.5rem;
      vertical-align: middle;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .btn {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      cursor: pointer;
      text-decoration: none;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px -10px rgba(102, 126, 234, 0.5);
    }
    .info {
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid #e2e8f0;
      font-size: 0.875rem;
      color: #a0aec0;
    }
    .info a {
      color: #667eea;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">CRM</div>
    <h1>${config.projectName}</h1>
    <p class="subtitle">Multi-Channel Customer Support System</p>

    <div id="status" class="status loading">
      <span class="spinner"></span>
      <span id="statusText">Checking system status...</span>
    </div>

    <div id="actions" style="display: none;">
      <a href="/login" class="btn">Go to Login</a>
    </div>

    <div class="info">
      <p>Backend API: <a href="${config.apiBaseUrl}/health" target="_blank">${config.apiBaseUrl}</a></p>
      <p style="margin-top: 0.5rem;">Powered by Cloudflare Workers + Pages</p>
    </div>
  </div>

  <script>
    window.CRM_CONFIG = {
      apiBaseUrl: '${config.apiBaseUrl}',
      wsBaseUrl: '${config.wsBaseUrl}',
      appUrl: '${config.appUrl}',
      projectName: '${config.projectName}'
    };

    async function checkHealth() {
      const statusEl = document.getElementById('status');
      const statusTextEl = document.getElementById('statusText');
      const actionsEl = document.getElementById('actions');

      try {
        const response = await fetch(window.CRM_CONFIG.apiBaseUrl + '/health');
        const data = await response.json();

        if (data.status === 'healthy') {
          statusEl.className = 'status success';
          statusTextEl.textContent = 'System is healthy and ready!';
          actionsEl.style.display = 'block';
        } else {
          throw new Error('System not healthy');
        }
      } catch (error) {
        statusEl.className = 'status error';
        statusTextEl.textContent = 'Unable to connect to backend. Please check the API URL.';
      }
    }

    checkHealth();
  </script>
</body>
</html>`;
  }

  /**
   * Generate _headers file for Cloudflare Pages
   */
  private generateHeaders(): string {
    return `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*.js
  Cache-Control: public, max-age=31536000, immutable

/*.css
  Cache-Control: public, max-age=31536000, immutable

/index.html
  Cache-Control: no-cache

/config.json
  Cache-Control: no-cache
`;
  }

  /**
   * Generate _redirects file for SPA routing
   */
  private generateRedirects(): string {
    return `/*    /index.html   200`;
  }

  /**
   * Get content type for a file path
   */
  getContentType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'svg': 'image/svg+xml',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'ico': 'image/x-icon',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'ttf': 'font/ttf',
      'eot': 'application/vnd.ms-fontobject'
    };
    return contentTypes[ext || ''] || 'application/octet-stream';
  }
}
