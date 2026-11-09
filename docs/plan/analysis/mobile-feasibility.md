# Mobile feasibility after Gemini integration

Date: 2026-11-09. Assessment only; native application development is not included in the approved completion work.

FocoMan uses Next.js server rendering, cookie authentication and Server Actions. The shared TypeScript types, validation and pure domain logic are reusable. Firestore Admin and server-only packages must remain on the server. Existing React DOM/Tailwind components are not native React Native screens.

| Route | Estimated engineering effort | Main work |
| --- | --- | --- |
| Restore/harden existing PWA | 5–10 person-days | Install behavior, offline fallback, mobile forms/downloads and real-device testing |
| Capacitor Android/iOS application | 15–25 person-days | Web shell integration, native Google authentication, token/session bridge, deep links, file sharing, notifications, signing and store submission |
| Expo/React Native owner/crew MVP | 40–70 person-days | Explicit authenticated HTTP API over server domain operations, native navigation/screens, auth, downloads, notifications and device QA |

These are estimates for one experienced developer, not commitments. They exclude unresolved web backlog, advanced offline sync, media ingestion/editing, third-party approval delays and full parity with every dashboard. A full native replica would require a separately enumerated screen/API scope. Native iOS build/release tooling and developer accounts must be available.

Start with dependable mobile web behavior while the operational/security gaps are closed. A short native authentication/download proof of concept should precede a fixed Capacitor estimate. Capacitor's native runtime supports web-first applications; it does not run the Next.js server inside a phone. Expo's Next.js integration applies to web, and its documentation explicitly excludes native SSR. Therefore a native client requires a deliberate server API boundary.

The fetched Gemini revision removed the previous service worker/offline route and replaced the install UI and icon set. The former report of existing offline resilience was based on the old local revision and is not evidence for the fetched version.

Primary references checked:

- [Capacitor documentation](https://capacitorjs.com/docs)
- [Expo: Using Next.js for web](https://docs.expo.dev/guides/using-nextjs/)

Remaining product choices before native implementation: Android first versus both stores; owner/crew-only versus customer app; required offline operations; push events; whether camera/media ingestion is part of scope. Customers can continue using the existing web tracking links.
