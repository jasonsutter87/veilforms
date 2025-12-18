# VeilForms - Next.js App

Privacy-first form builder with client-side encryption. Built with Next.js 16, React 19, and TypeScript.

## Repository

```
https://github.com/jasonsutter87/veilforms.git
```

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run lint` | Run ESLint |

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, TypeScript, SCSS
- **State**: Zustand
- **Drag & Drop**: @dnd-kit
- **Storage**: Netlify Blobs
- **Payments**: Stripe
- **Testing**: Vitest (617 tests), Playwright (E2E)
- **Logging**: Pino

## Project Structure

```
nextjs/
├── src/
│   ├── app/              # Next.js App Router pages & API routes
│   ├── components/       # React components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Core utilities & services
│   └── store/            # Zustand stores
├── e2e/                  # Playwright E2E tests
├── __tests__/            # Test setup & factories
├── vitest.config.ts      # Vitest configuration
└── playwright.config.ts  # Playwright configuration
```

## Architecture Highlights

- **Security**: CSP headers, CORS hardening, input sanitization, JWT entropy validation
- **Performance**: In-memory caching, bundle splitting, React.memo optimization
- **DRY**: Route handler wrappers, centralized validation, form ownership helpers
- **Logging**: Structured Pino logging throughout

## Tests

```bash
# Run all unit/integration tests
npm run test:run

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

**617 tests passing** across 19 test files.

## Environment Variables

See `.env.example` for required environment variables.

## License

MIT License
