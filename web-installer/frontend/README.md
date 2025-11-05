# Web Installer Frontend

**Vue 3 + TypeScript** application that provides a user-friendly interface for deploying the Multi-Channel CRM system.

## Features

- 🎨 Modern Vue 3 with Composition API
- 📘 Full TypeScript support
- 🗄️ Pinia state management
- 🛣️ Vue Router navigation
- ⚡ Vite build tool
- 🎭 Real-time SSE updates
- 📱 Responsive design
- 🔒 OAuth 2.0 + PKCE authentication

## Project Structure

```
frontend/
├── src/
│   ├── main.ts                    # App entry point
│   ├── App.vue                    # Root component
│   ├── router/
│   │   └── index.ts               # Vue Router config
│   ├── stores/
│   │   └── deploymentStore.ts     # Pinia store
│   ├── api/
│   │   └── installer.ts           # API client
│   ├── types/
│   │   └── index.ts               # TypeScript types
│   ├── views/                     # Page components (6)
│   │   ├── LandingPage.vue
│   │   ├── OAuthCallback.vue
│   │   ├── ConfigForm.vue
│   │   ├── DeployProgress.vue
│   │   ├── SuccessPage.vue
│   │   └── ErrorPage.vue
│   ├── components/                # Shared components (4)
│   │   ├── ProgressBar.vue
│   │   ├── LogConsole.vue
│   │   ├── CredentialsBox.vue
│   │   └── FeatureCard.vue
│   └── assets/
│       └── styles/
│           └── global.css         # Design system
├── public/                        # Static assets
├── index.html                     # HTML template
├── vite.config.ts                 # Vite configuration
├── tsconfig.json                  # TypeScript config
└── package.json                   # Dependencies
```

## Quick Start

### Prerequisites

- Node.js >= 18
- npm >= 9
- Backend Worker deployed

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### Development

```bash
# Start development server
npm run dev

# Frontend will be available at http://localhost:3000
```

### Building

```bash
# Type check
npm run type-check

# Build for production
npm run build

# Preview production build
npm run preview
```

### Deployment

**Quick Deployment:**
```bash
# Use the automated deployment script
chmod +x deploy.sh
./deploy.sh
```

**Manual Deployment:**
```bash
# Build production bundle
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=crm-installer-frontend
```

## Environment Variables

### Development (.env)

```bash
# API Base URL (empty = use Vite proxy)
VITE_API_BASE_URL=

# OAuth Redirect URI
VITE_OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback

# Environment
VITE_ENVIRONMENT=development
```

### Production (.env.production)

```bash
# API Base URL (your deployed Worker URL)
VITE_API_BASE_URL=https://web-installer-backend.xxx.workers.dev

# OAuth Redirect URI (your deployed Pages URL)
VITE_OAUTH_REDIRECT_URI=https://crm-installer-frontend.pages.dev/oauth/callback

# Environment
VITE_ENVIRONMENT=production
```

## User Flow

```
┌──────────────┐
│ Landing Page │ User clicks "Deploy to Cloudflare"
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ OAuth Flow   │ Redirects to Cloudflare, user authorizes
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Config Form  │ User enters project name, email, domain
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Deploy Page  │ Real-time progress via SSE (2-3 minutes)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Success Page │ Credentials displayed, CRM launched
└──────────────┘
```

## Key Components

### LandingPage.vue

Marketing page with:
- Hero section with CTA
- 6 feature cards
- How it works (4 steps)
- Pricing comparison
- Final CTA

### OAuthCallback.vue

Handles OAuth redirect:
- Validates state (CSRF protection)
- Exchanges code for token
- Stores session data
- Redirects to config form

### ConfigForm.vue

Deployment configuration:
- Project name validation
- Admin email input
- Custom domain (optional)
- Cost estimation
- Form validation

### DeployProgress.vue

Real-time deployment tracking:
- Overall progress (0-100%)
- 15 deployment steps
- Live log console (SSE)
- Cancel deployment option
- Resource display

### SuccessPage.vue

Deployment success:
- Animated checkmark
- Credentials box (copy/download)
- Quick start guide
- Resources summary
- Launch CRM button

### ErrorPage.vue

Error handling:
- Error details display
- Rollback information
- Common issues + solutions
- Try again / support options

## Design System

The application uses a comprehensive design system defined in `src/assets/styles/global.css`:

### CSS Variables

```css
/* Colors */
--color-primary: #667eea
--color-success: #10b981
--color-error: #ef4444
--color-warning: #f59e0b

/* Spacing */
--spacing-sm: 0.5rem
--spacing-md: 1rem
--spacing-lg: 1.5rem

/* Shadows */
--shadow-md: 0 4px 6px rgba(0,0,0,0.1)
--shadow-lg: 0 10px 15px rgba(0,0,0,0.1)
```

### Utility Classes

```css
.btn-primary        /* Primary button */
.btn-secondary      /* Secondary button */
.card               /* Card container */
.card-glass         /* Glass morphism effect */
.form-input         /* Form input field */
.badge-success      /* Success badge */
.spinner            /* Loading spinner */
```

## State Management

### Deployment Store (Pinia)

```typescript
// Store usage example
import { useDeploymentStore } from '@/stores/deploymentStore';

const deploymentStore = useDeploymentStore();

// Start deployment
await deploymentStore.startDeployment({
  projectName: 'my-crm',
  adminEmail: 'admin@example.com',
  accountId: 'xxx',
  oauthToken: 'xxx'
});

// Access state
deploymentStore.totalProgress  // 0-100
deploymentStore.currentStep    // Current step name
deploymentStore.logs           // Log entries
deploymentStore.credentials    // Admin credentials (on success)
```

## API Client

```typescript
// API client usage
import { oauthAPI, deploymentAPI } from '@/api/installer';

// OAuth authorization
const auth = await oauthAPI.authorize(redirectUri);

// Start deployment
const result = await deploymentAPI.startDeployment(config);

// Get status
const status = await deploymentAPI.getDeploymentStatus(projectName);
```

## Routing

### Route Configuration

```typescript
'/'                          // Landing page
'/oauth/callback'            // OAuth callback
'/configure'                 // Configuration form
'/deploy/:projectName'       // Deployment progress
'/success/:projectName'      // Success page
'/error'                     // Error page
```

### Navigation Guards

Authentication required for:
- `/configure`
- `/deploy/:projectName`

Checks for `oauth_token` and `account_id` in sessionStorage.

## Testing

Currently using manual testing. Future plans:

- [ ] Unit tests with Vitest
- [ ] Component tests with @vue/test-utils
- [ ] E2E tests with Playwright
- [ ] Visual regression tests

## Performance

### Build Optimization

- Code splitting by route
- Tree shaking for unused code
- Vendor chunk separation
- Minification with Terser
- Gzip compression

### Runtime Performance

- Virtual scrolling for logs
- Debounced input validation
- Lazy component loading
- Efficient re-renders with Vue 3

## Browser Support

- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90

## Troubleshooting

### Issue: "Cannot resolve @/..."

**Solution:** TypeScript path alias not configured. Check `tsconfig.json` and `vite.config.ts`.

### Issue: "API calls fail with CORS errors"

**Solution:**
1. Verify backend CORS configuration
2. Check `VITE_API_BASE_URL` in `.env`
3. Ensure backend is running

### Issue: "OAuth redirect fails"

**Solution:**
1. Verify redirect URI matches OAuth app config
2. Check `VITE_OAUTH_REDIRECT_URI` in `.env`
3. Ensure no trailing slashes

### Issue: "SSE events not received"

**Solution:**
1. Check browser console for errors
2. Verify EventSource support
3. Test SSE endpoint directly: `curl -N <backend-url>/deployment/test/events`

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT

## Support

- **Documentation**: See parent [README.md](../README.md)
- **Deployment**: See [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md)
- **Setup**: See [SETUP_GUIDE.md](../SETUP_GUIDE.md)
- **Issues**: [GitHub Issues](https://github.com/yourcompany/crm/issues)
