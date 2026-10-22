# Security maintenance

Reviewed 2026-10-22. Next.js is pinned to 16.4.2 and React/React DOM stay aligned. The lockfile resolves sharp 0.35.5 or later and source-map-js 1.2.2. No credentials were found in the scoped audit; no keys were rotated.

## Automated cadence

GitHub Actions runs Security checks every Monday at 10:20 Argentina time (UTC-3), as well as on main pushes, pull requests and manual dispatch. GitHub may delay scheduled runs; this is not an exact-time SLA. The jobs scan fetched Git history with checksum-verified Gitleaks and 100% redaction, audit the npm lockfile with fail-closed checks and reviewed framework minimums, audit Python requirements where present, and run CodeQL security-extended. They do not need a developer laptop, cloud warehouse credentials, paid runners or an AI model. Public repositories use standard GitHub-hosted runners. Potential-secret reports are not uploaded.

Dependabot opens PRs for known security vulnerabilities when a fix is available, with no automatic merge. General version-update PRs are disabled with open-pull-requests-limit: 0 for every ecosystem; this does not disable security updates. Review ordinary dependency versions and pinned GitHub Actions during monthly maintenance. Failed security checks use normal GitHub Actions notifications; dependency/security alerts use GitHub and Dependabot. Notification delivery depends on the owner's GitHub preferences; the workflow does not send email itself. This does not enable data-extraction jobs.

## Review and exceptions

No vulnerability exceptions are configured. The Next.js ESLint plugin's fast-glob dependency is replaced by a narrow local adapter backed by tinyglobby 0.2.17, eliminating the vulnerable braces chain without disabling any lint rules. A compatibility test covers the plugin's actual globSync/onlyDirectories call. Reassess this override when updating the plugin.

Run `python scripts/test_security_audit.py` and `python scripts/security_audit.py --directory .`. npm network errors, unknown inherited advisories, missing dev metadata and unreviewed prereleases fail closed. Current minimums are an additional guard, not a substitute for future vendor advisories. Never run npm audit fix --force blindly.

Once a month, a human should review official framework advisories, authentication/authorization changes, RLS if introduced, endpoint budgets/rate limits, public bundles, logs and hosted security headers. The weekly workflow does not prove absence of IDOR, account-recovery flaws, SSRF or a historical compromise. There is no automatic monthly penetration test. Recheck the scope when adding auth, private data, upload endpoints or a live AI agent.

## Browser headers

The full resource CSP is enforced in Vercel headers. Vercel is configured to publish the static out directory (framework null, no server adapter). Every production build additionally places a strict script policy in each prerendered HTML head before scripts: only same-origin external scripts and hashes of that build's inline scripts are permitted. No unsafe-inline or unsafe-eval is allowed by this document policy; inline event handlers are denied. The HTTP policy retains the framework-compatible inline allowance, but the more restrictive document policy also applies and blocks arbitrary inline scripts. Inline styles remain allowed for React/chart rendering. Hashes are generated from exact emitted bytes, never copied between builds. CI verifies the policy and attempts a blocked inline-script injection. Dynamic pages fail the build until a per-request nonce design is reviewed. The delivery decision and future-backend boundary are documented in static-security-delivery.md. There is no CSP report collector or paid logging service.

## Validation and deployment

Run the app's lint/typecheck/tests where defined and production build, inspect representative desktop/mobile routes, and check public headers after deployment. Confirm the deployed commit and resolved versions; an open PR alone is not remediation. Keep secrets in the provider store and revoke/rotate any confirmed exposed credential before relying on history cleanup.

Scheduled workflows in public repos can be disabled by GitHub after 60 days without repository activity. The monthly human review must check that Security checks is still enabled and has recent successful runs; do not create artificial commits to bypass this rule. Standard hosted runners on public repos are free; artifact retention is limited to seven days. [Scheduling](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows) · [Billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
