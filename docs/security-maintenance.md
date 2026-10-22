# Security maintenance

Reviewed 2026-10-22. Next.js is pinned to 16.4.2 and React/React DOM stay aligned. The lockfile resolves sharp 0.35.5 or later and source-map-js 1.2.2. No credentials were found in the scoped audit; no keys were rotated.

## Automated cadence

GitHub Actions runs Security checks every Monday at 10:20 Argentina time (UTC-3), as well as on main pushes, pull requests and manual dispatch. GitHub may delay scheduled runs; this is not an exact-time SLA. The jobs scan fetched Git history with checksum-verified Gitleaks and 100% redaction, audit the npm lockfile with fail-closed checks and reviewed framework minimums, audit Python requirements where present, and run CodeQL security-extended. They do not need a developer laptop, cloud warehouse credentials, paid runners or an AI model. Public repositories use standard GitHub-hosted runners. Potential-secret reports are not uploaded.

Dependabot opens PRs for known security vulnerabilities when a fix is available, with no automatic merge. General version-update PRs are disabled with open-pull-requests-limit: 0 for every ecosystem; this does not disable security updates. Review ordinary dependency versions and pinned GitHub Actions during monthly maintenance. Failed security checks use normal GitHub Actions notifications; dependency/security alerts use GitHub and Dependabot. Notification delivery depends on the owner's GitHub preferences; the workflow does not send email itself. This does not enable data-extraction jobs.

## Review and exceptions

A temporary exception accepts only GHSA-vfj7-8cjw-p6xm in dev-only braces until 2026-11-22. Upstream latest braces 3.0.3 has no compatible patched release as of review. Inherited ESLint warnings remain visible; runtime dependency placement, other advisories or expiry block the check. This is an accepted temporary risk, not a clean npm audit.

Run `python scripts/test_security_audit.py` and `python scripts/security_audit.py --directory .`. npm network errors, unknown inherited advisories, missing dev metadata and unreviewed prereleases fail closed. Current minimums are an additional guard, not a substitute for future vendor advisories. Never run npm audit fix --force blindly.

Once a month, a human should review official framework advisories, authentication/authorization changes, RLS if introduced, endpoint budgets/rate limits, public bundles, logs and hosted security headers. The weekly workflow does not prove absence of IDOR, account-recovery flaws, SSRF or a historical compromise. There is no automatic monthly penetration test. Recheck the scope when adding auth, private data, upload endpoints or a live AI agent.

## Browser headers

The frontend applies nosniff, anti-framing, referrer and browser-permission policies. CSP enforces base/object/frame/form restrictions; the full resource policy is Report-Only while resources and inline scripts are reviewed. It does not yet block every script source or provide a report collector. Verify the public deployment after each change; keep warnings distinct from enforced controls.

## Validation and deployment

Run the app's lint/typecheck/tests where defined and production build, inspect representative desktop/mobile routes, and check public headers after deployment. Confirm the deployed commit and resolved versions; an open PR alone is not remediation. Keep secrets in the provider store and revoke/rotate any confirmed exposed credential before relying on history cleanup.

Scheduled workflows in public repos can be disabled by GitHub after 60 days without repository activity. The monthly human review must check that Security checks is still enabled and has recent successful runs; do not create artificial commits to bypass this rule. Standard hosted runners on public repos are free; artifact retention is limited to seven days. [Scheduling](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows) · [Billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
