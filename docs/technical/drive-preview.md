# Google Drive preview delivery

Updated 2026-11-05. Related task: [DRIVE-001](../plan/tasks/drive-001.md). This records the feasible integration approach and the current delivery boundary; it does not claim a working Drive gallery.

## Current state

The tracking portal has no authorized order-to-file association, Drive metadata retrieval, or persisted photo-selection/review action. Unused sample filenames, seeded review text, and a handler that announced a successful save without persistence have been removed. The portal now states that media previews and reviews are unavailable and directs customers to their studio for files. Sharing an order does not grant Google Drive access.

No OAuth tokens, sharing settings, gallery entitlements, or external provider configuration changed. The information-only availability notice grants no gallery capability. No speculative URL parser or iframe was added without a real data path.

## Preferred delivery path

Use the complete `webViewLink` returned by Drive for an explicit **Open in Google Drive** action after FocoMan authorizes the viewer for that order. Google documents this field as its browser editor/viewer link. This avoids downloading and rendering originals through FocoMan; the viewer still transfers media from Google. This transfer conclusion is an architectural inference, not a zero-bandwidth guarantee. [Drive Files reference](https://developers.google.com/workspace/drive/api/reference/rest/v3/files).

Preserve resource keys in the original link. Some link-shared files require them, and Drive's returned viewer/download URLs include them. Do not reconstruct a URL that drops its resource key. [Resource keys](https://developers.google.com/workspace/drive/api/guides/resource-keys).

`thumbnailLink` is temporary, often lasting hours. It depends on the requesting application's content access; private-file thumbnails require credentialed retrieval. It must not be stored as a permanent public image URL. [File metadata guide](https://developers.google.com/workspace/drive/api/guides/file-metadata). Google also warns against direct web-app use because of CORS and suggests proxying. Such a proxy would still consume FocoMan bandwidth and needs bounded, authorized responses. [Drive Files reference](https://developers.google.com/workspace/drive/api/reference/rest/v3/files).

An in-app `/file/d/{id}/preview` iframe remains a candidate requiring real-file user validation. The checked API documentation establishes `webViewLink`, not a universally guaranteed embeddable viewer endpoint. An iframe's load event cannot establish successful playback or permission. Always retain an explicit Google viewer link when embedding is supported.

## Required implementation boundary

1. Owner-authenticated attachment action verifies the order's studio, current gallery entitlement and permitted Drive file association. Persist minimal metadata and resource key securely; never infer an association from a filename.
2. Server-authorized customer/collaborator retrieval checks the order role before returning file metadata. The current client-side tracking unlock is not a new media-authorization boundary.
3. Google separately checks file permissions. FocoMan must not make files public, leak owner tokens, or treat an order PIN as Google access.
4. Resolve revoked/missing/inaccessible files truthfully. Load media only on viewer request. Unsupported embedding offers **Open in Google Drive**, without claiming preview success.
5. Keep existing plan restrictions. Private galleries that must work without a client Google login need a separately scoped credential/access and delivery design; zero server transfer cannot be promised.

No third-party service was named in the request. No customer file was sent to a new service. A proposed provider can be compared later against this Google-hosted path and its privacy, access and cost requirements.

## User validation still required

Actual preview integration is pending an authorized file association implementation plus representative permitted files and user UAT. Check image, video and PDF files; Google-authorized and logged-out viewers; restricted and revoked access; unsupported media; and Safari on iPhone plus Chrome on Android. Confirm the viewer link preserves resource keys and uses the intended Google account. No automated browser UAT is permitted by repository instructions.

Current layout:

```text
Photos & Deliverables
Media previews are not available in this tracking portal yet.
Please contact your studio for photos, videos, and album files.
```

This is a truthful unavailable state, not an empty live Drive listing. The current change makes no claim that any files have been checked or that private previews work.
