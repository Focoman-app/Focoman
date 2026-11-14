# New-User Legal Consent

Status: Approved

## Authentication contract

Google authentication occurs before legal consent is determined. A Firebase
credential marked `additionalUserInfo.isNewUser` enters consent; existing
Google identities continue directly to their original redirect target.

This applies identically to:

- primary redirect sign-in;
- automatic redirect-to-popup fallback; and
- manual popup sign-in.

The auth-state observer must not redirect a new user before consent is stored.

## Consent interaction

```text
Google identity created
  → Terms and Privacy panels open by default
  → user scrolls both panels to their ends
  → checkbox becomes enabled
  → user checks agreement and submits
  → server records acceptance
  → continue to onboarding/original redirect
```

Terms and Privacy content is displayed in the consent view; simple external
links are not a replacement for reading gates. Scroll completion is a UI gate,
not evidence of legal comprehension.

## Persistence

Store consent server-side in a dedicated user-scoped record with:

- Firebase UID
- current terms and privacy version
- accepted timestamps

Existing identities bypass this new-user consent gate. Do not fabricate legacy
acceptance timestamps.
