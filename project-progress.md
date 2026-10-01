# Project Progress Report

**Project:** Northern Heritage Library  
**Date:** 28 September 2026  
**Status:** Production foundation is implemented; production deployment still requires configuration and end-to-end operational checks.

## Executive Summary

The project now has a Next.js application backed by PostgreSQL, database-backed authentication, paid page entitlements, an admin/superadmin console, and audit activity records. The database migration has been verified: the audit, password-reset, story-page, reading-progress, and saved-book tables exist, and the local database contains three seeded stories. The current production build passes.

The application is not yet ready for public production traffic. Vercel production secrets, live Paystack settings, verified email delivery, distributed rate limiting, durable uploaded-file storage, and final data-flow checks remain.

## Accomplished

- **Application and UI:** Next.js App Router, TypeScript, responsive library pages, and the dusk color system with Raleway, Montserrat, and Playfair Display.
- **Catalog:** Homepage highlights, catalog search, category listings/counts, story details, and reader content use PostgreSQL-backed published stories.
- **Database:** PostgreSQL schema and migration/seed scripts for users, stories, pages, payments, entitlements, saved books, reading progress, password resets, and system events.
- **Authentication:** Registration stores bcrypt password hashes; login verifies database accounts and sets an HTTP-only session cookie. Registration, login, and forgot-password have in-memory rate limits. Superadmin provisioning uses `npm run db:superadmin` and environment-provided credentials.
- **Password reset:** Reset tokens are random, stored as hashes, expire after one hour, and are single-use. Generic responses avoid account enumeration. A local development link is provided when email isn’t configured.
- **Reading and payments:** Table of contents and introduction are free; subsequent pages are entitlement-checked and priced at GHS 1. The reader supports per-page payment and story-wide checkout. Paystack initialization, verification, signed webhook processing, idempotent settlement, entitlement grants, and reading progress are implemented.
- **Story management:** Admin/superadmin routes support story CRUD, text-story authoring, and PDF text extraction into reader pages. Uploaded text pages are protected server-side; selectable-text PDFs up to 4 MB are supported. The PDF.js worker is registered directly for Node/Turbopack, and a local admin upload smoke test successfully extracted and published a 180-page PDF.
- **Admin and activity:** Admin/superadmin users share the protected operations console. It provides account, story, payment, revenue, and activity views, paginated payment/event records, story editing/publishing/deletion, text authoring, and PDF upload. Loading, empty, and error states are distinguished.
- **Audit events:** Server-observed events cover authentication, password resets, profile changes, reading/page access, progress, saved books, story operations, and payment initialization/settlement/failure.
- **Profile:** Profile name and picture editing, entitlement-gated saved books, published-story filtering, and saved-book removal are implemented with visible action feedback.
- **Transactional email:** Resend and React Email are wired for password reset, welcome, payment success/failure, and admin payment alerts.
- **Build validation:** The production build passes with the database-backed homepage rendered at request time; the Paystack webhook-secret regression test passes (1/1); the configured database accepts a read-only connectivity check; and the local PDF upload succeeded with the new story verified in admin and public search. Read-only provider checks confirmed Resend accepts its API key and Paystack returned the expected missing-reference response. No email or payment was initiated. Scoped lint on changed files reports no errors. Full-repository ESLint still fails on generated `library-router/.react-router/types`; existing warnings also remain.

## Remaining Before Vercel Production

### 1. Configure and verify Vercel environments

Set separate development, preview, and production values in Vercel Project Settings. At minimum configure:

- `DATABASE_URL` for a managed PostgreSQL instance, using the provider’s Vercel/serverless connection option.
- A unique, high-entropy `JWT_SECRET` and the session-cookie name.
- `NEXT_PUBLIC_APP_URL` set to the HTTPS production domain.
- Live `PAYSTACK_SECRET_KEY` and public key. Configure Paystack to call `/api/payments/paystack/webhook` and verify a complete live-mode purchase.
- `RESEND_API_KEY` and `AUTH_FROM_EMAIL` after verifying the sender domain.
- Superadmin email/password as deployment or one-time secure provisioning values; run `npm run db:superadmin` against the intended production database only after checking the target environment.

Run `npm run db:migrate` against production before enabling traffic. Seed sample data only in environments where sample stories are intended.

### 2. Complete email alerts

Resend and React Email are wired for password-reset, welcome, payment-success, payment-failure, and admin payment-alert emails. The Resend API key is accepted, but `AUTH_FROM_EMAIL` is still a placeholder, so delivery has not been tested. Before launch:

- Verify the sending domain and configure SPF, DKIM, and DMARC with the email provider.
- Set `RESEND_API_KEY`, a verified `AUTH_FROM_EMAIL`, and the production HTTPS `NEXT_PUBLIC_APP_URL` in Vercel.
- Test reset delivery, expiration, single-use behavior, registration welcome delivery, payment receipts/failures, and admin alerts in a Vercel preview environment. Email send failures are logged and do not roll back completed registration/payment writes; durable retry/outbox processing remains a follow-up.
- Define user notification preferences and retention rules for operational email.

The admin dashboard’s activity feed updates when refreshed; it is not currently a push/WebSocket real-time stream. Email can be triggered near real time from persisted events, while true live dashboard updates would need a separate realtime service or polling policy.

### 3. Finish production story/catalog data flows

- Decide whether the original PDF must be retained. The current upload flow extracts text but does not store the original PDF, images, or layout. Store originals in Vercel Blob or equivalent object storage if needed.
- Scanned/image-only PDFs are not OCR’d. Add OCR as a separate processing job if those documents must be supported.
- Large PDF parsing runs in the request handler and is limited to 4 MB/300 pages. For larger books or reliable Vercel execution, move parsing to background jobs and store files in object storage.
- Confirm admin-created pages render safely and review uploaded content before publishing.

### 4. Security and operational readiness

- Add a rate limit to payment initialization and replace the in-memory auth rate-limit store with a shared/distributed limiter for Vercel; consider bot protection for public forms.
- Replace the local `PAYSTACK_WEBHOOK_SECRET` placeholder with the correct webhook signing secret before testing webhook verification.
- Require a strong production `JWT_SECRET` rather than relying on the development fallback. Confirm HTTPS-only production cookies and same-origin/CSRF protections for account-changing requests.
- Add email verification before treating new accounts as verified, if required by the product.
- Review who can view personal data in the admin console, audit-log retention, export access, and incident response. Audit records describe instrumented server events, not every action in a user’s browser or infrastructure logs.
- Replace profile-image data URLs in PostgreSQL with object storage before scale; add image moderation/size limits and cleanup policies.
- Configure database backups, connection-pool limits, error monitoring, uptime alerts, and a documented restore test.
- Run end-to-end preview tests for registration, login, password reset email, admin story publishing, page payment, webhook retry/idempotency, entitlement access, and failed payments.

## Deployment Gate

**Ready now:** Production build compiles; local PostgreSQL migrations are verified; the Paystack environment regression test passes; public catalog data is database-backed; core account, story, reader, payment, and admin-monitoring code paths exist.

**Not yet ready for public launch:** Full-repository lint failures, verified email sender configuration, correct Paystack webhook secret, live Paystack setup, deployment environment configuration, upload storage/large-file strategy, distributed rate limiting, durable email retries, and preview end-to-end checks remain outstanding.

## Useful Commands

```powershell
npm run db:migrate
npm run db:seed
npm run db:superadmin
npm run build
```

`db:superadmin` should be run only against the explicitly selected environment. Keep `.env` and all production secrets out of source control and out of chat.
