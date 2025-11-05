<template>
  <div class="landing-page">
    <div class="container">
      <!-- Hero Section -->
      <section class="hero">
        <h1 class="hero-title">
          Deploy Your Multi-Channel CRM
          <span class="hero-gradient">in Minutes</span>
        </h1>
        <p class="hero-subtitle">
          One-click deployment to your Cloudflare account. No technical knowledge required.
          Start managing customer conversations across LINE and Facebook Messenger today.
        </p>
        <button @click="startDeployment" class="btn btn-primary btn-lg">
          <span>🚀 Deploy to Cloudflare</span>
        </button>
        <p class="hero-note">
          Free tier available • No credit card required • 2-3 minutes setup
        </p>
      </section>

      <!-- Features Section -->
      <section class="features">
        <h2 class="section-title">Why Choose Our CRM?</h2>
        <div class="features-grid">
          <FeatureCard
            icon="💬"
            title="Multi-Channel Support"
            description="Unified inbox for LINE OA and Facebook Messenger. Manage all customer conversations in one place."
          />
          <FeatureCard
            icon="⚡"
            title="Blazing Fast"
            description="Built on Cloudflare Workers. Global edge network ensures millisecond response times worldwide."
          />
          <FeatureCard
            icon="🔒"
            title="Secure & Private"
            description="Your data stays in your Cloudflare account. Complete control and privacy with enterprise-grade security."
          />
          <FeatureCard
            icon="💰"
            title="Cost Effective"
            description="Starts at $0/month on Cloudflare's free tier. Only pay for what you use as you grow."
          />
          <FeatureCard
            icon="🎯"
            title="Team Collaboration"
            description="Assign conversations to team members. Role-based access control with admin and agent roles."
          />
          <FeatureCard
            icon="📊"
            title="Real-Time Updates"
            description="WebSocket-powered live updates. See new messages and status changes instantly without refresh."
          />
        </div>
      </section>

      <!-- How It Works Section -->
      <section class="how-it-works">
        <h2 class="section-title">How It Works</h2>
        <div class="steps">
          <div class="step">
            <div class="step-number">1</div>
            <h3 class="step-title">Connect Cloudflare</h3>
            <p class="step-description">
              Authorize our installer to access your Cloudflare account via secure OAuth 2.0
            </p>
          </div>
          <div class="step">
            <div class="step-number">2</div>
            <h3 class="step-title">Configure</h3>
            <p class="step-description">
              Choose your project name, admin email, and optional custom domain
            </p>
          </div>
          <div class="step">
            <div class="step-number">3</div>
            <h3 class="step-title">Deploy</h3>
            <p class="step-description">
              Watch in real-time as we provision resources and deploy your CRM system
            </p>
          </div>
          <div class="step">
            <div class="step-number">4</div>
            <h3 class="step-title">Launch</h3>
            <p class="step-description">
              Receive your admin credentials and start managing customer conversations immediately
            </p>
          </div>
        </div>
      </section>

      <!-- Cost Estimation Section -->
      <section class="pricing">
        <h2 class="section-title">Transparent Pricing</h2>
        <div class="pricing-grid">
          <div class="pricing-card">
            <h3 class="pricing-tier">Free Tier</h3>
            <div class="pricing-price">$0<span>/month</span></div>
            <ul class="pricing-features">
              <li>✓ 100,000 requests/day</li>
              <li>✓ 5GB D1 database</li>
              <li>✓ 10GB R2 storage</li>
              <li>✓ Unlimited Pages hosting</li>
              <li>✓ Perfect for small businesses</li>
            </ul>
          </div>
          <div class="pricing-card pricing-card-featured">
            <div class="pricing-badge">Most Popular</div>
            <h3 class="pricing-tier">Growing Business</h3>
            <div class="pricing-price">$10-30<span>/month</span></div>
            <ul class="pricing-features">
              <li>✓ 10M requests/month</li>
              <li>✓ 25GB+ database storage</li>
              <li>✓ 100GB+ file storage</li>
              <li>✓ Custom domain included</li>
              <li>✓ Pay only for what you use</li>
            </ul>
          </div>
        </div>
        <p class="pricing-note">
          All prices are Cloudflare's standard rates. We don't charge any additional fees.
        </p>
      </section>

      <!-- CTA Section -->
      <section class="cta">
        <h2 class="cta-title">Ready to Get Started?</h2>
        <p class="cta-description">
          Deploy your own Multi-Channel CRM in less than 3 minutes
        </p>
        <button @click="startDeployment" class="btn btn-primary btn-lg">
          <span>🚀 Start Free Deployment</span>
        </button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { oauthAPI } from '@/api/installer';
import FeatureCard from '@/components/FeatureCard.vue';

// ========================================
// COMPOSABLES
// ========================================

const router = useRouter();

// ========================================
// METHODS
// ========================================

async function startDeployment(): Promise<void> {
  try {
    // Build redirect URI for OAuth callback
    const redirectUri = `${window.location.origin}/oauth/callback`;

    // Initiate OAuth flow
    const response = await oauthAPI.authorize(redirectUri);

    // Store state and code verifier in session storage
    sessionStorage.setItem('oauth_state', response.state);
    sessionStorage.setItem('oauth_code_verifier', response.codeVerifier);
    sessionStorage.setItem('oauth_redirect_uri', redirectUri);

    // Redirect to Cloudflare OAuth page
    window.location.href = response.authorizationUrl;
  } catch (error) {
    console.error('Failed to start OAuth flow:', error);
    alert('Failed to connect to Cloudflare. Please try again.');
  }
}
</script>

<style scoped>
.landing-page {
  min-height: 100vh;
  padding: var(--spacing-2xl) 0;
}

/* Hero Section */
.hero {
  text-align: center;
  padding: var(--spacing-3xl) 0;
}

.hero-title {
  font-size: var(--font-size-5xl);
  font-weight: var(--font-weight-bold);
  color: white;
  margin-bottom: var(--spacing-lg);
  line-height: 1.2;
}

.hero-gradient {
  display: block;
  background: linear-gradient(90deg, #f093fb 0%, #f5576c 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  max-width: 600px;
  margin: 0 auto var(--spacing-2xl);
  font-size: var(--font-size-xl);
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.6;
}

.hero-note {
  margin-top: var(--spacing-lg);
  font-size: var(--font-size-sm);
  color: rgba(255, 255, 255, 0.7);
}

/* Features Section */
.features {
  padding: var(--spacing-3xl) 0;
}

.section-title {
  text-align: center;
  font-size: var(--font-size-3xl);
  color: white;
  margin-bottom: var(--spacing-2xl);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--spacing-xl);
}

/* How It Works Section */
.how-it-works {
  padding: var(--spacing-3xl) 0;
}

.steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-xl);
}

.step {
  text-align: center;
  padding: var(--spacing-xl);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-xl);
}

.step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  margin-bottom: var(--spacing-md);
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: white;
  background: var(--gradient-primary);
  border-radius: 50%;
  box-shadow: var(--shadow-lg);
}

.step-title {
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-size-xl);
  color: white;
}

.step-description {
  margin: 0;
  color: rgba(255, 255, 255, 0.8);
}

/* Pricing Section */
.pricing {
  padding: var(--spacing-3xl) 0;
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--spacing-xl);
  max-width: 800px;
  margin: 0 auto var(--spacing-xl);
}

.pricing-card {
  position: relative;
  padding: var(--spacing-2xl);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-xl);
  text-align: center;
}

.pricing-card-featured {
  border: 2px solid #f093fb;
  box-shadow: 0 0 30px rgba(240, 147, 251, 0.3);
}

.pricing-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  padding: var(--spacing-xs) var(--spacing-md);
  background: linear-gradient(90deg, #f093fb 0%, #f5576c 100%);
  color: white;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  border-radius: var(--radius-full);
}

.pricing-tier {
  margin-bottom: var(--spacing-md);
  font-size: var(--font-size-xl);
  color: white;
}

.pricing-price {
  margin-bottom: var(--spacing-lg);
  font-size: var(--font-size-4xl);
  font-weight: var(--font-weight-bold);
  color: white;
}

.pricing-price span {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-normal);
  color: rgba(255, 255, 255, 0.7);
}

.pricing-features {
  list-style: none;
  text-align: left;
}

.pricing-features li {
  padding: var(--spacing-sm) 0;
  color: rgba(255, 255, 255, 0.9);
}

.pricing-note {
  text-align: center;
  font-size: var(--font-size-sm);
  color: rgba(255, 255, 255, 0.7);
}

/* CTA Section */
.cta {
  padding: var(--spacing-3xl) 0;
  text-align: center;
}

.cta-title {
  font-size: var(--font-size-3xl);
  color: white;
  margin-bottom: var(--spacing-md);
}

.cta-description {
  max-width: 600px;
  margin: 0 auto var(--spacing-xl);
  font-size: var(--font-size-lg);
  color: rgba(255, 255, 255, 0.9);
}

/* Responsive Design */
@media (max-width: 768px) {
  .hero-title {
    font-size: var(--font-size-3xl);
  }

  .hero-subtitle {
    font-size: var(--font-size-base);
  }

  .features-grid,
  .steps,
  .pricing-grid {
    grid-template-columns: 1fr;
  }
}
</style>
