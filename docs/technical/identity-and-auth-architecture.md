# FOCOMAN Authentication & Multi-Studio Identity Architecture Specification

**Document Type:** Technical & Product Architecture Specification  
**Status:** Active Target Specification  
**Project:** Focoman  
**Supersedes:** Legacy Username/Password, Separate Studio Login, and Owner-Generated Member Credential Specifications  

---

## 1. Core Identity Principle

Focoman enforces a **single personal identity per person**.

For Phase 1, **Google Sign-in through Firebase Authentication** is the sole authentication provider.

A Focoman identity is **NOT** inherently:
- a Studio
- a Studio Owner account
- a Studio Member account
- a Customer account

The authenticated person is uniquely and stably represented by their **Firebase UID**. Studio ownership and studio membership are distinct domain concepts modeled independently from authentication:

```text
Person / Focoman Identity
        ↓
   Firebase UID
        ↓
Studio Membership(s)
        ↓
Role / Permissions (Owner / Member / Skills)
```

### Multi-Studio Membership from Day One
The data model and architecture natively support:
1. Owning a studio.
2. Being a member of another studio.
3. Being a member of multiple independent studios simultaneously.
4. Owning one studio while concurrently acting as a crew member (e.g. photographer or editor) for other studios.

A person never creates multiple Focoman user accounts or separate logins to participate in multiple studios.

---

## 2. Google Authentication (Phase 1 Provider)

Firebase Authentication with **Google Sign-in** is the primary personal authentication provider for Phase 1:

- **No Custom Username/Password**: Neither Studio Owners nor Studio Members create or manage platform usernames or passwords.
- **No Phone/SMS Authentication**: Phone/SMS auth is not used for authentication in Phase 1 (customer phone numbers are captured strictly as operational order metadata).
- **No Anonymous Authentication**: Unauthenticated guest access is restricted strictly to customer order tracking passkeys, not anonymous Firebase user accounts.
- **No Additional Social Providers**: Facebook, Apple, and other social identity providers are excluded from Phase 1.
- **Decoupled Creation**: Authenticating with Google authenticates the *person*; it does **NOT** automatically generate or assume a Studio entity.

---

## 3. First-Time Google User Experience

Upon successful Google authentication, Focoman checks the user's relationships in Firestore:

### State A — No Studio Ownership & No Studio Memberships
The user is routed to a clear onboarding screen with two distinct, unforced options:

1. **`Register Your Studio`** — For studio owners establishing their business workspace.
2. **`Join an Existing Studio`** — For photographers, editors, and crew members who have received or are expecting an invitation from a studio owner.

**Strict UX Rules:**
- Do **NOT** force the user to create a studio automatically.
- Do **NOT** prompt the user to choose a separate Focoman username.
- Do **NOT** prompt the user to create a password.

---

## 4. Existing Members & Multi-Studio Fluidity

If an individual is already a member of one or more studios, they retain the full right to register their own studio at any time:

```text
Person (Firebase UID)
 ├── Studio A — Member (Photographer)
 ├── Studio B — Member (Video Editor)
 └── Register Your Studio (Option always accessible)
```

Being a Studio Member never restricts an individual from registering a new studio and becoming a Studio Owner.

### Multi-Workspace Selector
When an authenticated person owns or belongs to multiple studios, Focoman displays a workspace switcher:

```text
┌──────────────────────────────────────────────┐
│ Select Workspace                             │
├──────────────────────────────────────────────┤
│ Luminary Weddings                   [Owner]  │
│ Apex Cinematics                     [Member] │
│ PixelCraft Studios                  [Member] │
├──────────────────────────────────────────────┤
│ + Register Your Studio                       │
│ + Join an Existing Studio                    │
└──────────────────────────────────────────────┘
```

Users log in once with Google and navigate fluidly between authorized studio workspaces without logging out or maintaining separate credentials.

---

## 5. "Register Your Studio" Flow

The primary onboarding action for studio owners is explicitly labeled:

> **`Register Your Studio`**

*(Disallowed legacy phrasing: "Create Studio Account", "Create Studio Login", "Create Member Account", "Create Owner Username", "Studio Username Login".)*

Because the user is already authenticated with Google, studio registration collects only approved studio business metadata:
- **Studio Name** (required)
- **City / Primary Location** (required)
- **Website** (optional)
- **Instagram / Social Handle** (optional)

No artificial or redundant fields (such as studio passwords or separate owner usernames) are introduced.

```text
Google Account
      ↓
Firebase UID
      ↓
Focoman Identity
      ↓
Register Your Studio
      ↓
Studio Entity Created
      ↓
Owner Membership Attached
```

---

## 6. Studio Name & Identifier Uniqueness

Studio identity is derived from the approved studio naming model (e.g. unique studio slug derived from studio name).

1. **Real Database Verification**: Studio identifier availability must be validated against real Cloud Firestore data.
2. **No Fake/Client-Only Checks**: The platform must **never** rely on frontend-only validation, hardcoded mock arrays, cached lists, or synthetic delay simulations.
3. **Server-Side Concurrency Protection**: Final studio creation and uniqueness validation must execute on the server inside a **Firestore Transaction** to prevent race conditions and duplicate namespace collisions.
4. **Honest Availability Feedback**: The UI may show real-time validation checks against a dedicated server action, but availability is finalized only upon transactional database commit.

---

## 7. "Join an Existing Studio" & Member Invitation Lifecycle

Studio Members are **never** created through unrestricted public self-registration.

A member account is established exclusively via an owner-initiated invitation:

```text
Studio Owner
     ↓
Creates email-bound invitation or generic link + six-digit passcode
     ↓
Invited Person opens invitation link
     ↓
Authenticates with Google Sign-in
     ↓
System verifies email match or generic passcode
     ↓
Links Firebase UID to Studio Membership
     ↓
Activates Studio Member record (marks invitation ACCEPTED)
     ↓
Redirects to Studio Member Dashboard
```

- Email-bound invitations remain restricted to the specified Google account's verified email.
- If the Owner does not know the member's email, the Owner may create a generic invitation with a random single-use link token and a separate six-digit passcode. The recipient may claim it using their own Google account.
- Generic passcodes are stored as salted hashes, allow at most five failed attempts, and are not shown again after creation. A locked invite can be revoked and replaced.
- Invitations do not expire automatically. Owners can revoke pending invitations; successful claims are single-use and record the accepting Firebase UID.
- An already-accepted link routes its accepting account to that studio; other accounts see that the invitation has already been claimed.
- Studio Owners never generate or store passwords for their crew members.

---

## 8. Existing Focoman Users Receiving New Invitations

When an authenticated user who already uses Focoman (either as an owner or crew member elsewhere) receives an invitation to join another studio:

```text
Existing Authenticated Person (Firebase UID)
                 ↓
      Opens New Studio Invitation
                 ↓
      Accepts Invitation
                 ↓
      New Studio Membership created and linked to same UID
                 ↓
      Studio added to Person's Workspace Selector
```

No new Firebase accounts, distinct usernames, or duplicate profiles are created.

---

## 9. Firestore Data Model & Schema Separation

To enforce this architecture, Firestore entities are structured into normalized collections:

```text
/users/{firebaseUid}
  ├── email: string
  ├── displayName: string
  ├── photoURL?: string
  ├── createdAt: ISOString
  └── updatedAt: ISOString

/studios/{studioId}
  ├── id: string (unique slug, e.g. "luminary")
  ├── name: string ("Luminary Weddings")
  ├── ownerUid: string (Firebase UID of creator)
  ├── location: string
  ├── website?: string
  ├── instagram?: string
  ├── createdAt: ISOString
  └── updatedAt: ISOString

/memberships/{membershipId}  [composite: {studioId}_{firebaseUid}]
  ├── studioId: string
  ├── uid: string (Firebase UID)
  ├── role: "STUDIO_OWNER" | "STUDIO_MEMBER"
  ├── skills: string[] (e.g. ["PHOTOGRAPHY", "PHOTO_EDITING"])
  ├── status: "ACTIVE" | "INACTIVE"
  ├── joinedAt: ISOString
  └── updatedAt: ISOString

/invitations/{invitationId}
  ├── studioId: string
     ├── email?: string (verified Google email restriction when provided)
     ├── phone?: string (contact metadata only; not an authentication factor)
  ├── role: "STUDIO_MEMBER"
  ├── skills: string[]
     ├── claimCodeSalt?: string
     ├── claimCodeHash?: string (generic invites only; never store the passcode in plaintext)
     ├── failedClaimAttempts?: number
     ├── claimLocked?: boolean
     ├── status: "PENDING" | "ACCEPTED" | "REVOKED"
     ├── acceptedByUid?: string
  └── createdAt: ISOString
```

The invitation document ID is a high-entropy, single-use URL token. Generic invites additionally require the separately shared six-digit passcode. Invitation validity has no automatic time-based expiry; Owner revocation and one-time acceptance control use.

### Authorization Query Rule:
A user's accessible workspaces are discovered by querying `/memberships` where `uid == currentUser.uid` and `status == "ACTIVE"`.

---

## 10. Workspace Context & Navigation Routing

Following Google authentication, navigation resolves deterministically based on active memberships:

| Active Memberships Count | Routing Destination |
| :--- | :--- |
| **0 Memberships** | `/workspaces` (Shows `Register Your Studio` and `Join an Existing Studio`) |
| **1 Membership with a default workspace** | `/{studioSlug}/dashboard` directly (respecting role-scoped dashboard view) |
| **1 Membership without a default workspace** | `/workspaces` (Workspace Selector showing all studios, roles, and registration options) |
| **> 1 Memberships with a default workspace** | `/{defaultStudioSlug}/dashboard` directly |
| **> 1 Memberships without a default workspace** | `/workspaces` (Workspace Selector showing all studios, roles, and registration options) |

A workspace switcher in the dashboard navigation header allows instant switching between authorized studio workspaces at any time. The PWA application entry point is `/dashboard`; it resolves the default workspace using this routing table. The public landing page remains available at `/`, but is never an implicit in-app home destination.

---

## 11. Customer Identity & Order Tracking Isolation

Customers booking photography services are **NOT** part of the internal Focoman user identity system in Phase 1:
- Customers do **not** sign up for a Focoman account.
- Customers do **not** authenticate via Google or Firebase Auth.
- Customer order access is granted exclusively through the **Guest Tracking Passkey** (e.g. `FOC-AB12CD` or Order Number).
- Client phone numbers and emails stored on Orders exist solely as CRM contact records.

---

## 12. Superseded & Legacy Authentication Specifications

The following historical concepts are formally classified as **SUPERSEDED / ARCHIVED**:

1. **Owner-Created Member Credentials**: Any mechanism where a studio owner specifies a username and password for crew members is superseded by Google Authentication + Invitation Token linking.
2. **Separate Studio Login Portals**: Any pattern requiring distinct login URLs or distinct accounts per studio is superseded by the unified Google identity with multi-studio membership switching.
3. **Customer Firebase Accounts**: Any requirement to register customers into Firebase Auth for order status tracking is superseded by the lightweight passkey tracking model.
4. **Custom Platform Passwords / Legacy Tokens**: Completely eliminated in favor of Firebase Auth ID tokens verified server-side via Firebase Admin SDK.
