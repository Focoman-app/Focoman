# Server Action export build fix

Status: approved

## Problem

Vercel's Next build rejects `legalConsentActions.ts` because it is a
`"use server"` module that exports two string constants. A Server Action module
may only export asynchronous functions.

## Resolution

Keep the legal-version values private to `legalConsentActions.ts` because no
other module imports them. The legal-consent action retains the same validation,
stored values, return contract, and error behavior.

## Verification

1. The server-action file exports only the asynchronous action.
2. The stored consent record still receives the same version values.
3. Run `next build` from `apps/web` if dependencies permit, plus focused static
   checks and `git diff --check`.
