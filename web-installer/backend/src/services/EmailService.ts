/**
 * Email Service
 *
 * Sends deployment notification emails using Resend API
 */

import type { AdminCredentials, CloudflareResources } from '../types/deployment';

export interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  fromName?: string;
}

export class EmailService {
  private apiKey: string;
  private fromEmail: string;
  private fromName: string;
  private apiUrl = 'https://api.resend.com/emails';

  constructor(config: EmailConfig) {
    this.apiKey = config.apiKey;
    this.fromEmail = config.fromEmail;
    this.fromName = config.fromName || 'CRM Installer';
  }

  /**
   * Send deployment success email with credentials
   */
  async sendDeploymentSuccessEmail(
    toEmail: string,
    projectName: string,
    credentials: AdminCredentials,
    resources: CloudflareResources
  ): Promise<void> {
    const subject = ` Your CRM System is Ready - ${projectName}`;
    const html = this.generateSuccessEmailHTML(projectName, credentials, resources);
    const text = this.generateSuccessEmailText(projectName, credentials, resources);

    await this.sendEmail(toEmail, subject, html, text);
  }

  /**
   * Send deployment failure email
   */
  async sendDeploymentFailureEmail(
    toEmail: string,
    projectName: string,
    error: string
  ): Promise<void> {
    const subject = ` CRM Deployment Failed - ${projectName}`;
    const html = this.generateFailureEmailHTML(projectName, error);
    const text = this.generateFailureEmailText(projectName, error);

    await this.sendEmail(toEmail, subject, html, text);
  }

  /**
   * Send email using Resend API
   */
  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    text: string
  ): Promise<void> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: [to],
        subject,
        html,
        text
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send email: ${error}`);
    }
  }

  /**
   * Generate success email HTML
   */
  private generateSuccessEmailHTML(
    projectName: string,
    credentials: AdminCredentials,
    resources: CloudflareResources
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
    .url-box { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .warning { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
    code { background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1> Your CRM System is Ready!</h1>
      <p>Deployment completed successfully</p>
    </div>

    <div class="content">
      <h2>Welcome to your CRM system, ${projectName}!</h2>
      <p>Your Multi-Channel Customer Relationship Management system has been successfully deployed to Cloudflare.</p>

      <div class="credentials">
        <h3> Admin Credentials</h3>
        <p><strong>Username:</strong> <code>${credentials.username}</code></p>
        <p><strong>Password:</strong> <code>${credentials.password}</code></p>
        <p><strong>Email:</strong> <code>${credentials.email}</code></p>
      </div>

      <div class="warning">
        <strong> Important:</strong> Please save these credentials securely and change your password immediately after first login.
      </div>

      <h3> Your Application URLs</h3>
      <div class="url-box">
        <p><strong>Frontend (Main App):</strong><br>
        <a href="${resources.pagesUrl}">${resources.pagesUrl}</a></p>
      </div>
      <div class="url-box">
        <p><strong>Backend API:</strong><br>
        <a href="${resources.workerUrl}">${resources.workerUrl}</a></p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${resources.pagesUrl}" class="button">Open Your CRM →</a>
      </div>

      <h3> Next Steps</h3>
      <ol>
        <li><strong>Login:</strong> Click the button above or visit your CRM URL</li>
        <li><strong>Change Password:</strong> Go to Settings → Account → Change Password</li>
        <li><strong>Set up LINE OA:</strong> Go to Settings → Channels → LINE OA</li>
        <li><strong>Invite Team:</strong> Go to Team Management to add members</li>
      </ol>

      <h3> Need Help?</h3>
      <ul>
        <li> Email: <a href="mailto:support@yourcompany.com">support@yourcompany.com</a></li>
        <li> Documentation: <a href="https://docs.yourcompany.com">docs.yourcompany.com</a></li>
        <li> Discord: <a href="https://discord.gg/yourcompany">Join our community</a></li>
      </ul>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">

      <p style="font-size: 12px; color: #6b7280; text-align: center;">
        This email was sent by CRM Web Installer.<br>
        Deployed on ${new Date().toLocaleString()}
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate success email plain text
   */
  private generateSuccessEmailText(
    projectName: string,
    credentials: AdminCredentials,
    resources: CloudflareResources
  ): string {
    return `
 Your CRM System is Ready!

Welcome to your CRM system, ${projectName}!

Your Multi-Channel Customer Relationship Management system has been successfully deployed.

 ADMIN CREDENTIALS
Username: ${credentials.username}
Password: ${credentials.password}
Email: ${credentials.email}

  IMPORTANT: Save these credentials securely and change your password immediately after first login.

 YOUR APPLICATION URLS
Frontend: ${resources.pagesUrl}
Backend API: ${resources.workerUrl}

 NEXT STEPS
1. Login to your CRM
2. Change your password (Settings → Account → Change Password)
3. Set up LINE OA integration (Settings → Channels → LINE OA)
4. Invite team members (Team Management)

 NEED HELP?
- Email: support@yourcompany.com
- Documentation: https://docs.yourcompany.com
- Discord: https://discord.gg/yourcompany

---
Deployed on ${new Date().toLocaleString()}
    `.trim();
  }

  /**
   * Generate failure email HTML
   */
  private generateFailureEmailHTML(projectName: string, error: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #ef4444; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .error-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }
    code { background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1> Deployment Failed</h1>
      <p>We encountered an issue</p>
    </div>

    <div class="content">
      <p>Unfortunately, the deployment of your CRM system "${projectName}" failed.</p>

      <div class="error-box">
        <h3>Error Details</h3>
        <p><code>${error}</code></p>
      </div>

      <h3>What happened?</h3>
      <p>The deployment process encountered an error and has been automatically rolled back. No resources were left behind.</p>

      <h3>What to do next?</h3>
      <ol>
        <li>Please try deploying again</li>
        <li>If the issue persists, contact support with the error details above</li>
      </ol>

      <h3> Need Help?</h3>
      <ul>
        <li> Email: <a href="mailto:support@yourcompany.com">support@yourcompany.com</a></li>
        <li> Discord: <a href="https://discord.gg/yourcompany">Join our community</a></li>
      </ul>

      <p style="font-size: 12px; color: #6b7280; text-align: center; margin-top: 30px;">
        This email was sent by CRM Web Installer.
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate failure email plain text
   */
  private generateFailureEmailText(projectName: string, error: string): string {
    return `
 Deployment Failed

Unfortunately, the deployment of your CRM system "${projectName}" failed.

ERROR DETAILS:
${error}

WHAT HAPPENED?
The deployment process encountered an error and has been automatically rolled back.
No resources were left behind.

WHAT TO DO NEXT?
1. Please try deploying again
2. If the issue persists, contact support with the error details above

NEED HELP?
- Email: support@yourcompany.com
- Discord: https://discord.gg/yourcompany

---
This email was sent by CRM Web Installer.
    `.trim();
  }
}
