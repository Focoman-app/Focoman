import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldPath, FieldValue, getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  throw new Error("Marketplace purge requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.");
}

const auditOnly = process.argv.includes("--audit");

if (!auditOnly && process.env.CONFIRM_MARKETPLACE_PURGE !== "PURGE") {
  throw new Error("Set CONFIRM_MARKETPLACE_PURGE=PURGE to perform this irreversible cleanup.");
}

if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();
const removedCapabilityIds = new Set([
  "MARKETPLACE",
  "STUDIO_MARKETPLACE",
  "MARKETPLACE_CONFIGURATION",
  "MARKETPLACE_PUBLIC",
  "BOOKING_REQUESTS",
  "NEGOTIATION",
]);

async function deleteCollection(name) {
  let deleted = 0;
  while (true) {
    const snapshot = await db.collection(name).limit(400).get();
    if (snapshot.empty) return deleted;
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.size;
  }
}

async function removeField(collection) {
  let updated = 0;
  let cursor;
  while (true) {
    let query = db.collection(collection).orderBy(FieldPath.documentId()).limit(400);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) return updated;
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      if (Object.prototype.hasOwnProperty.call(doc.data(), "bookingRequestId")) {
        batch.update(doc.ref, { bookingRequestId: FieldValue.delete() });
        updated += 1;
      }
    });
    await batch.commit();
    cursor = snapshot.docs.at(-1);
    if (snapshot.size < 400) return updated;
  }
}

async function countField(collection) {
  let count = 0;
  let cursor;
  while (true) {
    let query = db.collection(collection).orderBy(FieldPath.documentId()).limit(400);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) return count;
    count += snapshot.docs.filter((doc) => Object.prototype.hasOwnProperty.call(doc.data(), "bookingRequestId")).length;
    cursor = snapshot.docs.at(-1);
    if (snapshot.size < 400) return count;
  }
}

async function inspectStudios() {
  let featureFlags = 0;
  let capabilities = 0;
  let cursor;
  while (true) {
    let query = db.collection("studios").orderBy(FieldPath.documentId()).limit(400);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) return { featureFlags, capabilities };
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data.features?.marketplace !== undefined) featureFlags += 1;
      if (Array.isArray(data.planInfo?.selectedCapabilities) && data.planInfo.selectedCapabilities.some((id) => removedCapabilityIds.has(id))) capabilities += 1;
    }
    cursor = snapshot.docs.at(-1);
    if (snapshot.size < 400) return { featureFlags, capabilities };
  }
}

async function normalizeStudios() {
  let updated = 0;
  let cursor;
  while (true) {
    let query = db.collection("studios").orderBy(FieldPath.documentId()).limit(400);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) return updated;
    const batch = db.batch();
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const update = {};
      let changed = false;
      if (data.features?.marketplace !== undefined) {
        update["features.marketplace"] = FieldValue.delete();
        changed = true;
      }
      if (Array.isArray(data.planInfo?.selectedCapabilities)) {
        const selectedCapabilities = data.planInfo.selectedCapabilities.filter((id) => !removedCapabilityIds.has(id));
        if (selectedCapabilities.length !== data.planInfo.selectedCapabilities.length) {
          update["planInfo.selectedCapabilities"] = selectedCapabilities;
          changed = true;
        }
      }
      if (changed) {
        batch.update(doc.ref, update);
        updated += 1;
      }
    }
    await batch.commit();
    cursor = snapshot.docs.at(-1);
    if (snapshot.size < 400) return updated;
  }
}

async function inspectPackages() {
  let legacyFields = 0;
  let cursor;
  while (true) {
    let query = db.collection("studio_packages").orderBy(FieldPath.documentId()).limit(400);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) return legacyFields;
    legacyFields += snapshot.docs.filter((doc) => {
      const data = doc.data();
      return data.isPublished !== undefined || data.isNegotiable !== undefined;
    }).length;
    cursor = snapshot.docs.at(-1);
    if (snapshot.size < 400) return legacyFields;
  }
}

async function normalizePackages() {
  let updated = 0;
  let cursor;
  while (true) {
    let query = db.collection("studio_packages").orderBy(FieldPath.documentId()).limit(400);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) return updated;
    const batch = db.batch();
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data.isPublished === undefined && data.isNegotiable === undefined) continue;
      batch.update(doc.ref, {
        isEnabled: typeof data.isEnabled === "boolean" ? data.isEnabled : data.isPublished !== false,
        isPublished: FieldValue.delete(),
        isNegotiable: FieldValue.delete(),
      });
      updated += 1;
    }
    await batch.commit();
    cursor = snapshot.docs.at(-1);
    if (snapshot.size < 400) return updated;
  }
}

if (auditOnly) {
  const [profiles, bookings, orders, payments, leads, studios, packageFields] = await Promise.all([
    db.collection("marketplace_profiles").count().get(),
    db.collection("booking_requests").count().get(),
    countField("orders"),
    countField("payments"),
    countField("leads"),
    inspectStudios(),
    inspectPackages(),
  ]);
  console.log(JSON.stringify({
    profiles: profiles.data().count,
    bookingRequests: bookings.data().count,
    orderLinks: orders,
    paymentLinks: payments,
    leadLinks: leads,
    studioFeatureFlags: studios.featureFlags,
    studioCapabilityLists: studios.capabilities,
    packageLegacyFields: packageFields,
  }));
  process.exit(0);
}

const [profilesDeleted, bookingsDeleted, ordersUpdated, paymentsUpdated, leadsUpdated, studiosUpdated, packagesUpdated] = await Promise.all([
  deleteCollection("marketplace_profiles"),
  deleteCollection("booking_requests"),
  removeField("orders"),
  removeField("payments"),
  removeField("leads"),
  normalizeStudios(),
  normalizePackages(),
]);

console.log(JSON.stringify({ profilesDeleted, bookingsDeleted, ordersUpdated, paymentsUpdated, leadsUpdated, studiosUpdated, packagesUpdated }));
