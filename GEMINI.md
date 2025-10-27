# GEMINI.md

## Project Overview

This project is a multi-channel customer support system built on a serverless architecture using Cloudflare Workers. The backend is developed with TypeScript and the Hono web framework, utilizing Drizzle ORM for database access. The frontend is a Vue.js application. The system integrates with various messaging platforms like LINE and Facebook Messenger, and it uses WebSockets and Durable Objects for real-time communication.

**Key Technologies:**

*   **Backend:** Cloudflare Workers, Hono, TypeScript, Drizzle ORM
*   **Frontend:** Vue.js, TypeScript
*   **Database:** Cloudflare D1 (SQLite compatible)
*   **Real-time:** WebSockets, Cloudflare Durable Objects
*   **Deployment:** Cloudflare Wrangler, Terraform

## Building and Running

### Development

To run the development server, use the following command:

```bash
npm run dev
```

This will start the Cloudflare Workers development server in remote mode.

### Building

To build the project, use the following command:

```bash
npm run build
```

This will compile the TypeScript code.

### Testing

The project uses Vitest for testing. To run the tests, use the following command:

```bash
npm run test:all
```

## Development Conventions

*   **Modular Architecture:** The project follows a modular architecture, with features organized into separate modules.
*   **TypeScript:** The entire codebase is written in TypeScript, ensuring type safety and code quality.
*   **Testing:** The project has an extensive test suite, with a goal of 100% test coverage.
*   **Linting:** The project uses ESLint to enforce a consistent coding style.
*   **Conventional Commits:** The project uses the Conventional Commits specification for its commit messages.
