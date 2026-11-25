# Security policy

## Reporting a vulnerability

Please do not open a public issue. Report it privately through this repository's **Security** tab ("Report a vulnerability"), which opens a private advisory visible only to the maintainer.

Include what you found, how to reproduce it, and the commit you tested. You can expect an acknowledgment within 7 days.

## Scope

This is a demo application that runs on synthetic data. In live mode it calls the Anthropic API from a local server route (`server/llm.ts`), so the API key stays on the server and never reaches the browser. Reports about key handling, the model route, or anything that could leak data between the simulated companies or platforms are in scope.

## Contributions

All changes to `main` go through a pull request and need the owner's approval (see `.github/CODEOWNERS`).
