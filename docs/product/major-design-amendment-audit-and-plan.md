# FOCOMAN — AUDIT REPORT & IMPLEMENTATION PLAN
## Major Product Design Amendment: Marketplace → Booking → Confirmed Order → OMS Lifecycle

---

### 1. CURRENT STATE
- **Data Model (`packages/types`, `packages/db`)**: Orders currently start directly as `CONFIRMED` or `DRAFT`. Packages exist in `studio_packages` collection.
- **OMS Workflow**: Confirmed orders automatically generate workflow tasks (`generateWorkflowTasks`).
- **Soft Delete & Recovery**: `RECOVERY_WINDOW_DAYS` is set to 14 in `packages/domain`. Soft deletion (`softDeleteOrder`, `restoreOrder`) exists.
- **Marketplace**: `/marketplace` lists studios. `/marketplace/[slug]` shows studio profile and packages.
- **Authentication**: Firebase Authentication with Google Identity and UID-based `StudioMembership`.

---

### 2. NEW APPROVED STATE
- **Full Lifecycle**: Marketplace → Studio Profile → Packages → Booking Request → Optional Negotiation → Agreed Amount → Advance Payment Request → Offline/Online Payment → Verification → Pre-flight Check → Booking Confirmed → Confirmed Order → Automated Resource Suggestions → Owner Confirmation → OMS Workflow → Delivery → Final Payment → Completed.
- **No Competitive Package Comparison**: No side-by-side comparison tables across studios.
- **Contracts Removed**: Explicitly out of scope.
- **Status Separation**: Distinct Order Status (`BOOKING_REQUEST`, `BOOKING_NEGOTIATING`, `AWAITING_PAYMENT`, `PAYMENT_PENDING_VERIFICATION`, `BOOKING_CONFIRMED`, `CONFIRMED_ORDER`, `CANCELLED`, `COMPLETED`), Payment Status (`PENDING`, `SUBMITTED`, `PENDING_VERIFICATION`, `VERIFIED`, `COMPLETED`), and Task Status.
- **Customer First-Class User**: Customer accounts tied to Firebase UID, relationship-based access, customer order history DTOs with strict internal data isolation.
- **Pre-flight & Resource Suggestions**: Operational conflict checks for date/location/crew/equipment and resource assignment suggestions requiring explicit owner confirmation.

---

### 3. GAP ANALYSIS
1. **Packages**: `StudioPackage` needs `isNegotiable: boolean` property and management action.
2. **Booking Requests**: Need server action & DB model for creating booking requests/leads directly from studio packages (`createBookingRequestAction`).
3. **Negotiation**: Need server action & status handling for `BOOKING_NEGOTIATING` and recording agreed amount (`recordNegotiatedAmountAction`).
4. **Advance & Offline Payments**: Need payment records with proof attachment (`paymentProofUrl`, `method`: `CASH`|`UPI`|`BANK_TRANSFER`|`OTHER`), status (`PENDING_VERIFICATION`), and verification action (`verifyPaymentAndConfirmBookingAction`).
5. **Pre-flight Conflict Check & Resource Suggestions**: Pre-flight evaluation function (`checkPreflightConflicts`) and resource suggestion engine (`generateResourceSuggestions`).
6. **Customer Account & Security**: Customer role and relationship-based access DTOs (`getCustomerOrderHistoryAction`).
7. **Status Enums & Schemas**: Update Zod schemas in `packages/validation` and types in `packages/types`.

---

### 4. FILES AFFECTED
- `packages/types/src/index.ts`
- `packages/db/src/index.ts`
- `packages/domain/src/index.ts`
- `packages/validation/src/index.ts`
- `apps/web/src/actions/marketplaceActions.ts`
- `apps/web/src/actions/orderActions.ts`
- `apps/web/src/actions/customerActions.ts`
- `apps/web/src/app/marketplace/[slug]/page.tsx`
- `apps/web/src/app/[studioSlug]/dashboard/oms/page.tsx`
- `apps/web/src/app/[studioSlug]/dashboard/marketplace/page.tsx`
- `apps/web/src/app/track/[passkey]/page.tsx`
- `tests/backend-crud.test.ts`

---

### 5. DATA MODEL CHANGES
- **`StudioPackage`**: Add `isNegotiable?: boolean`.
- **`Order`**: Add `bookingStatus`, `isNegotiable`, `negotiatedAmount`, `advanceRequested`, `advancePaid`, `paymentProofUrl`, `paymentVerificationState` (`PENDING` | `SUBMITTED` | `PENDING_VERIFICATION` | `VERIFIED`), `cancelledReason`, `cancelledAt`, `cancelledBy`, `locationDetails` (`address`, `googleMapsUrl`, `notes`).
- **`BookingRequest`**: Structured booking request interface.
- **`ResourceSuggestion`**: Structure for automated assignment suggestions.

---

### 6. AUTH CHANGES
- Customer user authentication uses Firebase UID with `relationship: CUSTOMER`.
- Support customer registration/sign-in seamlessly without separate password systems.

---

### 7. AUTHORIZATION CHANGES
- Validate all server action mutations server-side (`requireVerifiedUser`, `requireStudioMember`).
- Customer endpoint (`getCustomerOrderHistoryAction`) enforces `customerId === decoded.uid` and returns sanitized DTOs excluding private studio notes, internal tasks, crew info, or internal financials.

---

### 8. STATUS/LIFECYCLE CHANGES
- Clear separation between Order/Booking status, Payment status, and Task status.
- `CANCELLED` preserves historical record; `softDelete` sets `isDeleted: true` with 14-day recovery.

---

### 9. MIGRATION RISKS
- Existing orders with legacy status (`DRAFT`, `CONFIRMED`) mapped smoothly to `CONFIRMED_ORDER` for backward compatibility.
- Ensure test suite verifies both new lifecycle and existing OMS task generation.

---

### 10. TEST PLAN
1. Package negotiable flag & studio ownership test.
2. Booking request & negotiation state transition test.
3. Offline payment recording, payment proof, & studio owner verification test.
4. Pre-flight conflict check & resource suggestion test.
5. Customer order history DTO data isolation test.
6. Cancellation vs Soft-delete 14-day recovery test.
