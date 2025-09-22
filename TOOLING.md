# Projekt Tooling & Arbeitsweise

Dieses Dokument beschreibt die festgelegten Tools, Workflows und Best Practices für die Entwicklung unserer modularen Gastro-App.  
Alle Entwickler:innen (aktuell 2, später 3–4) orientieren sich daran.

---

## Repositories & Code

- **GitHub** mit Protected Branches, CODEOWNERS, PR-Templates
- **Monorepo** via **Turborepo** + **pnpm**
- **Branching**: Trunk-based, kurze Feature-Branches
- **PR-Checks**: typecheck, lint, tests, build müssen grün sein
- **CI/CD**: GitHub Actions für Lint, Tests, Build, Deploy, DB-Migrations

---

## App & Hosting

- **Next.js 15** (App Router, RSC, Route Handlers)
- **Vercel**: Hosting, Previews, Edge Functions, Env Aliasing
- **Supabase**: Postgres, Auth, Storage, Edge Functions
- **Supabase CLI** + **dbmate** für versionierte SQL-Migrationen
- **n8n**: Self-hosted für ETL, Automations, Webhooks

---

## Qualität & Tests

- **TypeScript** im strict mode
- **ESLint** + **Prettier** oder **Biome**
- **Vitest** für Unit/Integration
- **Playwright** für E2E (gegen Vercel Preview-URLs)
- **Zod** für API/DB-Schemas
- **lefthook** als Pre-Commit Hook Runner

---

## UI & DX

- **Tailwind CSS** + **shadcn/ui** Komponenten
- **Framer Motion** für Animationen
- **Storybook** optional für Komponenten
- **Figma** für Design System
- **Cursor** als KI-gestützter Editor

---

## Observability & Monitoring

- **Sentry** für Errors (Frontend & Backend)
- **OpenTelemetry** für Traces
- **Better Stack Uptime** / **Healthchecks.io** für Cron & Jobs
- **PostHog** für Produkt-Analytics & Feature-Flags

---

## Doku & Wissen

- **/docs** Ordner im Monorepo mit **Nextra**
- **Architecture Decision Records (ADR)** im /adr Ordner
- **Mermaid** oder ERD-SVGs versioniert im Repo
- **Changesets** für Versionierung & Changelogs

---

## Secrets & Compliance

- **1Password Teams** oder **Doppler** für Secrets-Verteilung
- **direnv** für lokale ENV Handhabung
- **SOPS** optional für verschlüsselte Configs im Repo

---

## Kollaboration & PM

- **Linear** für Issues, Roadmap, GitHub-Sync
- **Slack** mit GitHub, Linear, Sentry, n8n Alerts
- **Onboarding Playbook** im Repo für neue Devs

---

## Dev-Environments

- **Dev Containers** (.devcontainer) mit Node, pnpm, Supabase CLI
- **Docker Compose** für n8n, Fake-S3, Mailhog lokal
- **Neon** als Branching-DB für Ephemeral Envs in PRs

---

## Sicherheitsnetz

- **CSP** via Next Middleware
- **2FA** überall verpflichtend
- **Renovate** für Dependency Updates

---

## Arbeitsweise

- **Release-Zyklus**: wöchentlich, Hotfix jederzeit
- **Feature-Flags**: für inkrementelle Auslieferung
- **Reviewer-Rotation** bei PRs
- **Kleine PRs** bevorzugt
- **Pairing** optional mit Cursor und Linear Integration

---

*Letzte Aktualisierung: 2025-09-22*
