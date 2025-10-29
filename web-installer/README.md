# 🚀 Multi-Channel CRM Web Installer

> **One-Click Self-Hosted Deployment for Small Businesses**

Deploy your own Multi-Channel Customer Relationship Management system to Cloudflare in minutes, with zero technical knowledge required.

[![Tests](https://img.shields.io/badge/tests-28%20passing-brightgreen)](./backend/tests)
[![Coverage](https://img.shields.io/badge/coverage-90.6%25-brightgreen)](./backend/coverage)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

---

## ✨ Features

### For End Users
- 🎯 **One-Click Deployment** - No coding or terminal commands required
- 🔐 **Secure OAuth** - Direct authentication with Cloudflare
- 📊 **Real-time Progress** - Watch your deployment happen live
- 💰 **Cost Transparent** - Starts at $0/month on Cloudflare Free tier
- 🔄 **Automatic Rollback** - Failed deployments clean up automatically
- 📧 **Email Credentials** - Receive admin access details instantly

### For Developers
- 🏗️ **Production-Ready** - Enterprise-grade architecture
- 🧪 **Well Tested** - 90.6% code coverage with 28 passing tests
- 📚 **Fully Documented** - Comprehensive developer guides
- 🔌 **Extensible** - Easy to customize and extend
- ⚡ **Fast** - Cloudflare Workers edge computing
- 🛠️ **TypeScript** - Full type safety

---

## 🎬 Demo

![Web Installer Demo](./docs/images/demo.gif)

**Live Demo:** https://installer-demo.yourcompany.com

---

## 🚀 Quick Start

### For End Users (Deploying CRM)

1. Visit https://installer.yourcompany.com
2. Click "Deploy to Cloudflare"
3. Authorize access to your Cloudflare account
4. Fill in your project details:
   - Project name (e.g., `my-crm`)
   - Admin email
   - Custom domain (optional)
5. Click "Start Deployment"
6. Wait 2-3 minutes for completion
7. Receive credentials via email
8. Start using your CRM!

**Requirements:**
- Cloudflare account (free tier works)
- Valid email address

### For Developers (Setting up Installer)

```bash
# Clone repository
git clone https://github.com/yourcompany/crm-installer.git
cd crm-installer

# Backend setup
cd backend
npm install
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your credentials
npm run dev

# Frontend setup (in new terminal)
cd frontend
npm install
cp .env.development.example .env.development
# Edit .env.development
npm run dev
```

Visit:
- Frontend: http://localhost:3000
- Backend: http://localhost:8787

---

## 📋 What Gets Deployed?

When a user deploys through the Web Installer, the system creates:

### Cloudflare Resources
- ✅ **D1 Database** - SQLite on the edge (5GB free)
- ✅ **KV Namespaces** x2 - Key-value storage for sessions
- ✅ **R2 Bucket** - Object storage for file uploads (10GB free)
- ✅ **Queue** - Message queue for delayed messages
- ✅ **Worker** - Backend API (100k requests/day free)
- ✅ **Pages** - Frontend hosting (unlimited free)

### Database Schema
- 26+ tables for complete CRM functionality
- Indexes and foreign keys configured
- Initial admin user created

### Application Features
- LINE OA integration ready
- Real-time chat interface
- Team management
- File upload & storage
- Delayed messaging
- Multi-language support

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     User Browser                        │
│                                                         │
│  ┌───────────────────────────────────────────────┐    │
│  │          Vue 3 Frontend (Pages)               │    │
│  │  • Landing → OAuth → Config → Progress        │    │
│  │  • Real-time SSE updates                      │    │
│  │  • Pinia state management                     │    │
│  └───────────────────────────────────────────────┘    │
│                         │                              │
└─────────────────────────┼──────────────────────────────┘
                          │ REST API / SSE
                          ▼
┌─────────────────────────────────────────────────────────┐
│           Cloudflare Worker (Backend)                   │
│                                                         │
│  ┌──────────────────────────────────────────────┐     │
│  │     Durable Object: DeploymentOrchestrator   │     │
│  │  • 15-step deployment pipeline               │     │
│  │  • State persistence                         │     │
│  │  • SSE broadcasting                          │     │
│  │  • Automatic rollback                        │     │
│  └──────────────────────────────────────────────┘     │
│                         │                              │
│                         ▼                              │
│  ┌──────────────────────────────────────────────┐     │
│  │         Cloudflare API Service               │     │
│  │  • D1, KV, R2, Queue provisioning            │     │
│  │  • Worker & Pages deployment                 │     │
│  │  • Domain configuration                      │     │
│  └──────────────────────────────────────────────┘     │
│                         │                              │
└─────────────────────────┼──────────────────────────────┘
                          │
                          ▼
            ┌──────────────────────────┐
            │  Cloudflare Platform     │
            │  • Resource provisioning │
            │  • Deployment execution  │
            └──────────────────────────┘
```

---

## 🧪 Testing

### Run Tests

```bash
# Backend tests
cd backend
npm test                  # Run all tests
npm run test:coverage     # With coverage report
npm run test:watch        # Watch mode
```

### Test Results

```
✅ 28 tests passing (100% pass rate)
📊 90.6% overall coverage
✅ 100% function coverage
✅ 79.06% branch coverage
```

### Test Categories
- **Unit Tests:** Validation, errors, utilities
- **Integration Tests:** API flows, database operations
- **E2E Tests:** Full deployment simulation

---

## 📚 Documentation

- **[Developer Documentation](./DEVELOPER_DOCUMENTATION.md)** - Complete technical guide
- **[API Reference](./docs/API_REFERENCE.md)** - REST API endpoints
- **[Deployment Guide](./docs/DEPLOYMENT_GUIDE.md)** - Production deployment
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues & solutions
- **[Contributing](./CONTRIBUTING.md)** - How to contribute

---

## 💰 Cost Estimation

### Cloudflare Free Tier (Typical Small Business)
- **Workers:** 100,000 requests/day - **$0**
- **D1 Database:** 5GB storage - **$0**
- **R2 Storage:** 10GB - **$0**
- **Pages:** Unlimited requests - **$0**
- **KV Namespace:** 100,000 reads/day - **$0**

**Total:** **$0/month** for most deployments!

### Paid Tier (Growing Business)
- **Workers Paid:** $5/month for 10M requests
- **D1 Paid:** $5/month for 25GB
- **R2 Paid:** $0.015/GB storage

**Typical Cost:** $10-30/month at scale

---

## 🛠️ Technology Stack

### Backend
- **Runtime:** Cloudflare Workers
- **Framework:** Hono
- **Language:** TypeScript
- **Database:** Cloudflare D1 (SQLite)
- **Storage:** R2, KV
- **State:** Durable Objects

### Frontend
- **Framework:** Vue 3
- **State:** Pinia
- **Build:** Vite
- **Language:** TypeScript
- **Styling:** CSS3
- **Icons:** Unicode Emoji

---

## 🔒 Security

- ✅ OAuth 2.0 authentication with Cloudflare
- ✅ CSRF protection with state parameter
- ✅ Input validation on all endpoints
- ✅ Secure credential transmission
- ✅ Automatic secret generation
- ✅ No credentials stored in installer

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for your changes
4. Ensure all tests pass (`npm test`)
5. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge computing platform
- [Vue.js](https://vuejs.org/) - Progressive JavaScript framework
- [Hono](https://hono.dev/) - Lightweight web framework
- [Vite](https://vitejs.dev/) - Next generation frontend tooling

---

## 📞 Support

- **Documentation:** https://docs.yourcompany.com/installer
- **Issues:** [GitHub Issues](https://github.com/yourcompany/crm-installer/issues)
- **Email:** support@yourcompany.com
- **Discord:** [Join our community](https://discord.gg/yourcompany)

---

## 🗺️ Roadmap

- [x] OAuth authentication
- [x] Automated resource provisioning
- [x] Real-time progress tracking
- [x] Automatic rollback
- [x] Email notifications
- [ ] Multi-region deployment
- [ ] Custom branding options
- [ ] Deployment templates
- [ ] Resource cost calculator
- [ ] One-click updates

---

**Made with ❤️ by the Development Team**

**Star ⭐ this repo if you find it helpful!**
