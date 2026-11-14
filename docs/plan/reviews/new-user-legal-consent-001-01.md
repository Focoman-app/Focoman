# Review: new-user-legal-consent-001

## Findings

1. **P1 — blocking**
   - **Design location:** `docs/plan/analysis/new-user-legal-consent.md`,
     Consent interaction: the consent view must display the Terms and Privacy
     content that the user accepts.
   - **Implementation location:** `apps/web/src/app/sign-in/page.tsx`,
     `LegalDocument`.
   - The consent panels contain shortened, rewritten summaries rather than the
     published documents at `apps/web/src/app/terms/page.tsx` and
     `apps/web/src/app/privacy/page.tsx`. For example, the Terms panel merges
     material sections into a new "Data, billing and termination" paragraph
     and does not reproduce the published Terms text. A user therefore accepts
     text that differs from the Terms/Privacy pages. Reuse one canonical legal
     content source in both the public pages and consent panels before release.

## Verification

- The consent record is server-side, authenticated through
  `requireVerifiedUser`, and stores current Terms/Privacy versions and
  acceptance timestamps.
- Redirect, automatic popup fallback, and manual popup all return credentials
  to the same `handleCredential` path. Session synchronization is deferred by
  the candidate/pending session flags until an existing credential is cleared
  or a new-user consent record is saved.
- Both `<details>` panels are open by default. Each scroll container must reach
  its end before the checkbox enables; the submit button additionally requires
  a checked checkbox.
- The legacy normal-sign-in terms checkbox and associated blocking state are
  absent.
- `git diff --check` passes.

## Conclusion

**blocked** — authentication gating behavior matches the approved design, but
the legal text presented for acceptance must be identical to the published
Terms and Privacy Policy before delivery.
