# GEMINI.md

## Project Overview

This project is a multi-channel customer support system built on a serverless architecture using Cloudflare Workers. It follows a **Modular Architecture**, ensuring scalability and maintainability.

The backend is developed with TypeScript and the Hono web framework, utilizing Drizzle ORM for database access (Cloudflare D1). The frontend is a Vue.js application. The system integrates with various messaging platforms like LINE and Facebook Messenger, and utilizes WebSockets and Durable Objects for robust real-time communication.

**Key Technologies:**

*   **Backend:** Cloudflare Workers, Hono, TypeScript, Drizzle ORM
*   **Validation:** Zod, @hono/zod-validator
*   **Frontend:** Vue.js, TypeScript
*   **Database:** Cloudflare D1 (SQLite compatible)
*   **Real-time:** WebSockets, Cloudflare Durable Objects (with batch broadcasting optimization)
*   **Deployment:** Cloudflare Wrangler, Terraform

## Project Structure

The `src` directory is organized to support a modular and scalable design:

*   `src/modules/`: Contains feature-specific modules (e.g., `teams`, `auth`).
*   `src/handlers/`: Route handlers (being migrated to modules).
*   `src/services/`: Business logic and service layers.
*   `src/durable-objects/`: Durable Objects definitions for stateful operations.
*   `src/db/`: Database schema (Drizzle ORM) and migrations.
*   `src/core/`: Core system utilities, including the Smart Route Registry.
*   `src/integrations/`: External platform integrations (e.g., LINE, Facebook).

## Building and Running

### Development

To run the development server (runs Cloudflare Workers in remote mode):

```bash
npm run dev
```

### Database Management

The project uses Drizzle ORM. Common commands include:

*   **Generate Migrations:** `npm run db:generate`
*   **Apply Migrations (Remote):** `npm run db:migrate`
*   **Seed Database:** `npm run db:seed`

### Building & Deploying

*   **Build TypeScript:** `npm run build`
*   **Deploy to Cloudflare:** `npm run deploy`

### Testing

The project uses Vitest.

*   **Run All Tests:** `npm run test:all`
*   **Run Unit Tests:** `npm run test:handlers`
*   **Load Testing:** `npm run test:load`

## Development Conventions

*   **Modular Architecture:** Features are organized into separate modules within `src/modules`.
*   **Role System:** The system currently supports a 2-layer role hierarchy: **Admin** and **Agent** (Simplified from previous 3-layer system).
*   **TypeScript:** Strict TypeScript usage for type safety.
*   **Linting & Formatting:** ESLint and Prettier are enforced.
*   **Conventional Commits:** Commit messages must follow the Conventional Commits specification.

## Recent Significant Changes

*   **Role System Simplification:** Reduced roles from Admin/Team/Agent to Admin/Agent. Team functionality is preserved but the "Team" role type is removed.
*   **P1 Optimization (WebSocket):** Implemented batch broadcasting for Durable Objects, significantly reducing invocations and costs while maintaining acceptable latency.
*   **Smart Route Registry:** Improved routing system to handle conflicts and priorities better.

## Related Components

*   **TechStack/pubsub**: A reference implementation for a real-time publish-subscribe system on Cloudflare Workers.