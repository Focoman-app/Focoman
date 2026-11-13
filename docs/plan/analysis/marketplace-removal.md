# Studio Marketplace Removal

## Approved decision

Studio Marketplace is permanently removed. Focoman remains an OMS-first product:
studio owners manage internal services/packages and register direct confirmed
orders. Public studio discovery, booking requests, negotiation, payment proof
for bookings, and booking-to-order conversion are out of scope.

## Legacy data disposition

Purge these Firestore collections after a credentialed server-side audit:

- `marketplace_profiles`
- `booking_requests`

Remove Marketplace-only linkage fields (`bookingRequestId`) from `orders`,
`payments`, and `studio_leads`; remove legacy Marketplace feature flags and
capabilities from studio records; and normalize `studio_packages` to its
private `isEnabled` contract. Keep `studio_packages`, because it is the
internal Services catalog used by OMS order registration.

## Architecture boundary

```text
Services page ──> studioActions ──> studio_packages ──> OMS order form

Public routes/profile/booking/conversion/capabilities ──> removed
```

The Services package contract has no public visibility or negotiation state.
Existing package documents are retained and normalized by the internal service
catalog path. No fallback Marketplace behavior is permitted.

## Delivery tasks

1. Remove public Marketplace routes, UI, actions, conversion flow, and copy.
2. Remove Marketplace types, validation, entitlement/configuration, database
   helpers, tests, and documentation while preserving internal packages.
3. Run the credentialed data audit/purge, then scan source and run checks.

## Verification

- No source reference to Marketplace capabilities, profile, booking request,
  conversion, or public Marketplace routes remains.
- Services can create/delete packages through `studioActions`.
- OMS can consume internal packages without public-package fields.
- Data purge reports collection and field-update counts from real Firestore;
  it must fail truthfully if credentials are unavailable.
