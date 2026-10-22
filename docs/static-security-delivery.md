# Static security delivery

The current application reads public/synthetic snapshots and prerenders every user-facing route. It has no login, server actions, private runtime database or model API. Next.js still builds the React application, but Vercel publishes the exported out directory with framework null and an explicit build command. No server adapter or runtime function is needed.

This makes the tested artifact the served artifact. A build step parses the emitted HTML and adds an inline-script hash policy. Vercel applies the full resource policy from vercel.json. The browser intersects both policies: the header permits framework-compatible inline execution, while the document permits only the known build hashes. Inline handlers and eval remain blocked. Inline styles remain allowed for charts. Unknown/dynamic application routes fail the static build; actual exported error documents are hardened too.

The choice preserves route content, local React development, snapshot loading and client filters while avoiding adapter transformations, runtime compute and server-rendering attack surface. It introduces no paid service. A future authenticated backend, server action, upload or live AI service needs a separate security and cost review; do not silently add it to this deployment.

Verify the public HTML and hashes after each deployment, plus nested routes, asset URLs and cache headers. Local build success alone does not prove that a hosting adapter serves the same artifact.
