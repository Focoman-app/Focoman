import 'server-only';
import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import type {
  Studio,
  StudioMember,
  StudioMembership,
  StudioInvitation,
  Customer,
  Order,
  Task,
  MarketplaceProfile,
  StudioPackage,
  BookingRequest,
  PaymentRecord,
  StudioLead,
} from '@focoman/types';
import { RECOVERY_WINDOW_DAYS } from '@focoman/config';

/**
 * Server-Only Firestore Database Access & Repository Boundary
 * Supports complete CRUD, soft-delete, restore, and 14-day recovery window.
 * No in-memory fallback in production.
 */

if (typeof window !== 'undefined') {
  throw new Error(
    '@focoman/db is a SERVER-ONLY module and must never be imported into browser client bundles.'
  );
}

let firebaseAppInstance: App | null = null;
let firestoreDbInstance: Firestore | null = null;

function parsePrivateKey(rawKey: string | undefined): string | undefined {
  if (!rawKey) return undefined;
  let key = rawKey.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  return key.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n');
}

export function getFirestoreServerInstance(): Firestore {
  if (firestoreDbInstance) {
    return firestoreDbInstance;
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    'focoman';

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY);

  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseAppInstance = existingApps[0];
  } else if (clientEmail && privateKey && projectId) {
    firebaseAppInstance = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  } else {
    // Fallback initialization using default project credentials
    firebaseAppInstance = initializeApp({ projectId });
  }

  firestoreDbInstance = getFirestore(firebaseAppInstance);
  try {
    firestoreDbInstance.settings({ ignoreUndefinedProperties: true });
  } catch {
    // ignore if already set
  }
  return firestoreDbInstance;
}

// ============================================================================
// RECOVERY HELPER
// ============================================================================

export function isWithinRecoveryWindow(deletedAt?: string | null, windowDays = RECOVERY_WINDOW_DAYS): boolean {
  if (!deletedAt) return true;
  const deletedTime = new Date(deletedAt).getTime();
  const maxAllowedTime = deletedTime + windowDays * 24 * 60 * 60 * 1000;
  return Date.now() <= maxAllowedTime;
}

// ============================================================================
// 1. STUDIOS & WORKSPACES
// ============================================================================

export async function getStudioBySlug(slug: string): Promise<Studio | null> {
  const firestore = getFirestoreServerInstance();
  const clean = slug.toLowerCase();

  // 1. Try document ID directly
  const docSnap = await firestore.collection('studios').doc(clean).get();
  if (docSnap.exists) {
    const studio = docSnap.data() as Studio;
    if (!studio.isDeleted) return studio;
  }

  // 2. Try where 'id' == clean
  const snap = await firestore
    .collection('studios')
    .where('id', '==', clean)
    .limit(1)
    .get();
  if (!snap.empty) {
    const studio = snap.docs[0].data() as Studio;
    if (!studio.isDeleted) return studio;
  }

  // 3. Fallback to raw slug
  if (clean !== slug) {
    const rawDoc = await firestore.collection('studios').doc(slug).get();
    if (rawDoc.exists) {
      const studio = rawDoc.data() as Studio;
      if (!studio.isDeleted) return studio;
    }
  }

  return null;
}

export async function saveStudio(studio: Studio): Promise<Studio> {
  const firestore = getFirestoreServerInstance();
  await firestore.collection('studios').doc(studio.id).set(studio, { merge: true });
  return studio;
}

export async function registerStudioTransaction(
  studio: Studio,
  membership: StudioMembership
): Promise<{ success: boolean; error?: string }> {
  const firestore = getFirestoreServerInstance();
  const sid = studio.id.toLowerCase();

  try {
    const studioRef = firestore.collection('studios').doc(sid);
    const studioDoc = await studioRef.get();
    if (studioDoc.exists) {
      const existingData = studioDoc.data() as Studio;
      if (!existingData.isDeleted) {
        return { success: false, error: `Studio identifier "${studio.id}" is already in use.` };
      }
      // Studio was previously deleted: purge any leftover historical data before registering anew
      await purgeAllStudioData(sid);
    } else {
      // Purge any orphaned records that might exist with this studioId
      await purgeAllStudioData(sid);
    }

    await firestore.runTransaction(async (transaction) => {
      transaction.set(studioRef, studio);
      const membershipRef = firestore.collection('memberships').doc(membership.id);
      transaction.set(membershipRef, membership);
    });
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Transaction failed.' };
  }
}

export async function updateStudio(studioId: string, updates: Partial<Studio>): Promise<Studio | null> {
  const firestore = getFirestoreServerInstance();
  const ref = firestore.collection('studios').doc(studioId);
  await ref.update({ ...updates, updatedAt: new Date().toISOString() });

  // Sync studio details to marketplace profile if it exists
  try {
    if (updates.logoUrl !== undefined || updates.name || updates.city) {
      const mpRef = firestore.collection('marketplace_profiles').doc(studioId);
      const mpSnap = await mpRef.get();
      if (mpSnap.exists) {
        const mpUpdates: Record<string, any> = { updatedAt: new Date().toISOString() };
        if (updates.logoUrl !== undefined) mpUpdates.logoUrl = updates.logoUrl;
        if (updates.name) mpUpdates.name = updates.name;
        if (updates.city) mpUpdates.city = updates.city;
        await mpRef.update(mpUpdates);
      }
    }
  } catch (err) {
    console.warn('[updateStudio] Error syncing with marketplace profile:', err);
  }

  const snap = await ref.get();
  return snap.exists ? (snap.data() as Studio) : null;
}

export async function softDeleteStudio(studioId: string, deletedByUid: string): Promise<boolean> {
  const firestore = getFirestoreServerInstance();
  const now = new Date().toISOString();
  await firestore.collection('studios').doc(studioId).update({
    isDeleted: true,
    deletedAt: now,
    deletedBy: deletedByUid,
    updatedAt: now,
  });

  // Deactivate active memberships so this deleted studio does not appear in active workspaces
  const memSnap = await firestore
    .collection('memberships')
    .where('studioId', '==', studioId.toLowerCase())
    .where('status', '==', 'ACTIVE')
    .get();

  if (!memSnap.empty) {
    const batch = firestore.batch();
    memSnap.docs.forEach((doc) => {
      batch.update(doc.ref, { status: 'INACTIVE', updatedAt: now });
    });
    await batch.commit();
  }
  return true;
}

export async function archiveStudioToHeadless(studioId: string): Promise<boolean> {
  const firestore = getFirestoreServerInstance();
  const sid = studioId.toLowerCase();
  const now = new Date().toISOString();
  const archivedTag = `${sid}__archived_${Date.now()}`;

  // 1. Fetch studio doc to capture name if needed
  let studioName = "Studio";
  try {
    const studioDoc = await firestore.collection('studios').doc(sid).get();
    if (studioDoc.exists) {
      studioName = (studioDoc.data() as Studio)?.name || studioName;
    }
  } catch {
    // Non-fatal
  }

  // 2. Detach orders and convert them to headless records (NEVER DELETE CUSTOMER ORDERS)
  try {
    const ordersSnap = await firestore.collection('orders').where('studioId', '==', sid).get();
    if (!ordersSnap.empty) {
      const docs = ordersSnap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const batch = firestore.batch();
        const chunk = docs.slice(i, i + 400);
        chunk.forEach((d) => {
          batch.update(d.ref, {
            isHeadless: true,
            studioStatus: 'INACTIVE',
            archivedStudioId: sid,
            studioId: archivedTag,
            updatedAt: now,
          });
        });
        await batch.commit();
      }
    }
  } catch (err) {
    console.warn(`[archiveStudioToHeadless] Error archiving orders for ${sid}:`, err);
  }

  // 3. Move associated tasks to archived studio tag so they remain attached to orders for customer tracking
  try {
    const tasksSnap = await firestore.collection('tasks').where('studioId', '==', sid).get();
    if (!tasksSnap.empty) {
      const docs = tasksSnap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const batch = firestore.batch();
        const chunk = docs.slice(i, i + 400);
        chunk.forEach((d) => {
          batch.update(d.ref, {
            studioId: archivedTag,
            updatedAt: now,
          });
        });
        await batch.commit();
      }
    }
  } catch (err) {
    console.warn(`[archiveStudioToHeadless] Error archiving tasks for ${sid}:`, err);
  }

  // 4. Move payments to archived tag so customer payment history and receipts stay intact
  try {
    const paymentsSnap = await firestore.collection('payments').where('studioId', '==', sid).get();
    if (!paymentsSnap.empty) {
      const docs = paymentsSnap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const batch = firestore.batch();
        const chunk = docs.slice(i, i + 400);
        chunk.forEach((d) => {
          batch.update(d.ref, {
            studioId: archivedTag,
            updatedAt: now,
          });
        });
        await batch.commit();
      }
    }
  } catch (err) {
    console.warn(`[archiveStudioToHeadless] Error archiving payments for ${sid}:`, err);
  }

  // 5. Clean up ephemeral studio operational collections: memberships, invitations, studio_packages
  const ephemeralCols = ['memberships', 'invitations', 'studio_packages', 'booking_requests', 'members'];
  for (const colName of ephemeralCols) {
    try {
      const snap = await firestore.collection(colName).where('studioId', '==', sid).get();
      if (!snap.empty) {
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += 400) {
          const batch = firestore.batch();
          const chunk = docs.slice(i, i + 400);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }
    } catch (err) {
      console.warn(`[archiveStudioToHeadless] Error deleting from ${colName} for studio ${sid}:`, err);
    }
  }

  // 6. Delete marketplace profile if exists
  try {
    await firestore.collection('marketplace_profiles').doc(sid).delete();
  } catch (err) {
    console.warn(`[archiveStudioToHeadless] Error deleting marketplace_profile for studio ${sid}:`, err);
  }

  // 7. Delete the active studio document so the slug `sid` is immediately freed up for new registration!
  try {
    await firestore.collection('studios').doc(sid).delete();
  } catch (err) {
    console.warn(`[archiveStudioToHeadless] Error deleting studio doc for ${sid}:`, err);
  }

  return true;
}

export async function purgeAllStudioData(studioId: string): Promise<boolean> {
  return await archiveStudioToHeadless(studioId);
}

export async function hardDeleteStudio(studioId: string): Promise<boolean> {
  return await archiveStudioToHeadless(studioId);
}

export async function leaveStudioMembership(uid: string, studioId: string): Promise<boolean> {
  const firestore = getFirestoreServerInstance();
  const sid = studioId.toLowerCase();

  const memSnap = await firestore
    .collection('memberships')
    .where('uid', '==', uid)
    .where('studioId', '==', sid)
    .get();

  if (memSnap.empty) return false;

  const batch = firestore.batch();
  memSnap.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
  return true;
}

export async function restoreStudio(studioId: string): Promise<boolean> {
  const firestore = getFirestoreServerInstance();
  const docRef = firestore.collection('studios').doc(studioId);
  const doc = await docRef.get();
  if (!doc.exists) return false;
  const data = doc.data() as Studio;
  if (!isWithinRecoveryWindow(data.deletedAt)) {
    throw new Error(`Cannot restore studio: Recovery window of ${RECOVERY_WINDOW_DAYS} days has expired.`);
  }
  const now = new Date().toISOString();
  await docRef.update({
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    updatedAt: now,
  });
  return true;
}

export async function resetStudioWhatsappConfig(studioId: string): Promise<boolean> {
  const firestore = getFirestoreServerInstance();
  const now = new Date().toISOString();
  await firestore.collection('studios').doc(studioId).update({
    whatsappConfig: {},
    updatedAt: now,
  });
  return true;
}

// MEMBERSHIPS
export async function getMembershipsByUid(uid: string, email?: string): Promise<StudioMembership[]> {
  const firestore = getFirestoreServerInstance();
  const snap = await firestore
    .collection('memberships')
    .where('uid', '==', uid)
    .where('status', '==', 'ACTIVE')
    .get();

  const memberships = snap.docs
    .map((d) => d.data() as StudioMembership)
    .filter((m) => !m.isDeleted);
  const existingStudioIds = new Set(memberships.map((m) => m.studioId.toLowerCase()));

  try {
    const studiosSnap = await firestore.collection('studios').where('ownerId', '==', uid).get();
    for (const doc of studiosSnap.docs) {
      const studio = doc.data() as Studio;
      if (!studio.isDeleted && !existingStudioIds.has(studio.id.toLowerCase())) {
        const ownerMembership: StudioMembership = {
          id: `${studio.id}_${uid}`,
          studioId: studio.id,
          studioName: studio.name,
          uid,
          role: 'STUDIO_OWNER',
          status: 'ACTIVE',
          joinedAt: studio.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        memberships.push(ownerMembership);
        existingStudioIds.add(studio.id.toLowerCase());

        try {
          await firestore.collection('memberships').doc(ownerMembership.id).set(ownerMembership, { merge: true });
        } catch {
          // ignore auto-heal background errors
        }
      }
    }
  } catch (err) {
    console.warn('[getMembershipsByUid] Error fetching owned studios fallback:', err);
  }

  return memberships;
}

export async function getMembershipByUidAndStudio(
  uid: string,
  studioId: string
): Promise<StudioMembership | null> {
  if (!studioId || !uid) return null;
  const firestore = getFirestoreServerInstance();
  const snap = await firestore
    .collection('memberships')
    .where('uid', '==', uid)
    .where('studioId', '==', studioId.toLowerCase())
    .where('status', '==', 'ACTIVE')
    .get();
  if (snap.empty) return null;
  const activeDoc = snap.docs
    .map((d) => d.data() as StudioMembership)
    .find((m) => !m.isDeleted);
  return activeDoc || null;
}

export async function getMembershipsByStudio(
  studioId: string
): Promise<StudioMembership[]> {
  if (!studioId) return [];
  const firestore = getFirestoreServerInstance();
  const snap = await firestore
    .collection('memberships')
    .where('studioId', '==', studioId.toLowerCase())
    .where('status', '==', 'ACTIVE')
    .get();
  return snap.docs
    .map((d) => d.data() as StudioMembership)
    .filter((m) => !m.isDeleted);
}

// USER PREFERENCES (Default Studio Workspace)
export async function getUserDefaultStudio(uid: string): Promise<string | null> {
  if (!uid) return null;
  const firestore = getFirestoreServerInstance();
  const snap = await firestore.collection('user_preferences').doc(uid).get();
  if (!snap.exists) return null;
  return snap.data()?.defaultStudioId || null;
}

export async function setUserDefaultStudio(uid: string, studioId: string | null): Promise<boolean> {
  if (!uid) return false;
  const firestore = getFirestoreServerInstance();
  await firestore.collection('user_preferences').doc(uid).set(
    {
      defaultStudioId: studioId,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  return true;
}

// ============================================================================
// 2. ORDERS (OMS)
// ============================================================================

export async function getOrdersByStudio(studioId: string): Promise<Order[]> {
  const firestore = getFirestoreServerInstance();
  const snap = await firestore
    .collection('orders')
    .where('studioId', '==', studioId.toLowerCase())
    .get();
  const orders = snap.docs
    .map((d) => d.data() as Order)
    .filter((order) => !order.isDeleted);
  return orders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

export async function getDeletedOrdersByStudio(studioId: string): Promise<Order[]> {
  const firestore = getFirestoreServerInstance();
  const snap = await firestore
    .collection('orders')
    .where('studioId', '==', studioId.toLowerCase())
    .get();
  const orders = snap.docs
    .map((d) => d.data() as Order)
    .filter((order) => !!order.isDeleted);
  return orders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  if (!orderId) return null;
  const firestore = getFirestoreServerInstance();
  const doc = await firestore.collection('orders').doc(orderId).get();
  if (doc.exists) {
    const order = doc.data() as Order;
    if (order.isDeleted) return null;
    return order;
  }
  return getOrderByPasskey(orderId);
}

export async function getOrderByIdIncludeDeleted(orderId: string): Promise<Order | null> {
  const firestore = getFirestoreServerInstance();
  const doc = await firestore.collection('orders').doc(orderId).get();
  if (doc.exists) return doc.data() as Order;
  return null;
}

export async function getOrderByPasskey(identifier: string): Promise<Order | null> {
  const clean = identifier.trim().toUpperCase();
  const firestore = getFirestoreServerInstance();

  // 1. Try trackingPasskey
  let snap = await firestore
    .collection('orders')
    .where('trackingPasskey', '==', clean)
    .limit(1)
    .get();

  // 1b. If identifier is a 6-digit PIN, try passkeyPin directly
  if (snap.empty && /^\d{6}$/.test(clean)) {
    snap = await firestore
      .collection('orders')
      .where('passkeyPin', '==', clean)
      .limit(1)
      .get();
  }

  if (snap.empty) {
    // 2. Try orderNumber (e.g. ORD-TES-260928-172054)
    snap = await firestore
      .collection('orders')
      .where('orderNumber', '==', clean)
      .limit(1)
      .get();
  }

  if (!snap.empty) {
    const order = snap.docs[0].data() as Order;
    if (order.isDeleted) return null;
    return order;
  }

  // 3. Try document ID
  const doc = await firestore.collection('orders').doc(clean).get();
  if (doc.exists) {
    const order = doc.data() as Order;
    if (!order.isDeleted) return order;
  }

  return null;
}

export async function getOrdersByCustomerUid(uid: string, email?: string): Promise<Order[]> {
  const firestore = getFirestoreServerInstance();
  const results: Order[] = [];
  const seenIds = new Set<string>();

  // 1. Query by customer.uid
  const snapUid = await firestore
    .collection('orders')
    .where('customer.uid', '==', uid)
    .get();

  snapUid.docs.forEach((doc) => {
    const data = doc.data() as Order;
    if (!data.isDeleted && !seenIds.has(data.id)) {
      seenIds.add(data.id);
      results.push(data);
    }
  });

  // 2. Query by customer.email if available
  if (email && email.trim()) {
    const snapEmail = await firestore
      .collection('orders')
      .where('customer.email', '==', email.trim().toLowerCase())
      .get();

    snapEmail.docs.forEach((doc) => {
      const data = doc.data() as Order;
      if (!data.isDeleted && !seenIds.has(data.id)) {
        seenIds.add(data.id);
        results.push(data);
      }
    });
  }

  return results.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

export async function saveOrder(order: Order): Promise<Order> {
  const firestore = getFirestoreServerInstance();
  await firestore.collection('orders').doc(order.id).set(order, { merge: true });
  return order;
}

export async function updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null> {
  const firestore = getFirestoreServerInstance();
  const ref = firestore.collection('orders').doc(orderId);
  await ref.update({ ...updates, updatedAt: new Date().toISOString() });
  const snap = await ref.get();
  return snap.exists ? (snap.data() as Order) : null;
}

export async function softDeleteOrder(orderId: string, deletedByUid: string): Promise<boolean> {
  const firestore = getFirestoreServerInstance();
  const now = new Date().toISOString();
  await firestore.collection('orders').doc(orderId).update({
    isDeleted: true,
    deletedAt: now,
    deletedBy: deletedByUid,
    updatedAt: now,
  });
  // Cascade soft-delete to tasks
  const tasksSnap = await firestore.collection('tasks').where('orderId', '==', orderId).get();
  if (!tasksSnap.empty) {
    const batch = firestore.batch();
    tasksSnap.docs.forEach((doc) => {
      batch.update(doc.ref, {
        isDeleted: true,
        deletedAt: now,
        deletedBy: deletedByUid,
        updatedAt: now,
      });
    });
    await batch.commit();
  }
  return true;
}

export async function restoreOrder(orderId: string): Promise<boolean> {
  const firestore = getFirestoreServerInstance();
  const ref = firestore.collection('orders').doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const order = snap.data() as Order;
  if (!isWithinRecoveryWindow(order.deletedAt)) {
    throw new Error(`Cannot restore order: ${RECOVERY_WINDOW_DAYS}-day recovery window expired.`);
  }
  const now = new Date().toISOString();
  await ref.update({
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    updatedAt: now,
  });
  // Cascade restore to tasks
  const tasksSnap = await firestore.collection('tasks').where('orderId', '==', orderId).get();
  if (!tasksSnap.empty) {
    const batch = firestore.batch();
    tasksSnap.docs.forEach((doc) => {
      batch.update(doc.ref, {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        updatedAt: now,
      });
    });
    await batch.commit();
  }
  return true;
}

// ============================================================================
// 3. CUSTOMERS (CRM)
// ============================================================================

export async function getCustomersByStudio(studioId: string): Promise<Customer[]> {
  const firestore = getFirestoreServerInstance();
  const snap = await firestore
    .collection('customers')
    .where('studioId', '==', studioId.toLowerCase())
    .get();
  return snap.docs
    .map((d) => d.data() as Customer)
    .filter((c) => !c.isDeleted);
}

export async function getDeletedCustomersByStudio(studioId: string): Promise<Customer[]> {
  const firestore = getFirestoreServerInstance();
  const snap = await firestore
    .collection('customers')
    .where('studioId', '==', studioId.toLowerCase())
    .get();
  return snap.docs
    .map((d) => d.data() as Customer)
    .filter((c) => !!c.isDeleted);
}

export async function getCustomerById(customerId: string): Promise<Customer | null> {
  const firestore = getFirestoreServerInstance();
  const doc = await firestore.collection('customers').doc(customerId).get();
  if (doc.exists) {
    const customer = doc.data() as Customer;
    if (customer.isDeleted) return null;
    return customer;
  }
  return null;
}

export async function getCustomerByIdIncludeDeleted(customerId: string): Promise<Customer | null> {
  const firestore = getFirestoreServerInstance();
  const doc = await firestore.collection('customers').doc(customerId).get();
  if (doc.exists) return doc.data() as Customer;
  return null;
}

export async function saveCustomer(customer: Customer): Promise<Customer> {
  const firestore = getFirestoreServerInstance();
  await firestore.collection('customers').doc(customer.id).set(customer, { merge: true });
  return customer;
}

export async function updateCustomer(customerId: string, updates: Partial<Customer>): Promise<Customer | null> {
  const firestore = getFirestoreServerInstance();
  const ref = firestore.collection('customers').doc(customerId);
  await ref.update({ ...updates, updatedAt: new Date().toISOString() });
  const snap = await ref.get();
  return snap.exists ? (snap.data() as Customer) : null;
}

export async function softDeleteCustomer(customerId: string, deletedByUid: string): Promise<boolean> {
  const firestore = getFirestoreServerInstance();
  const now = new Date().toISOString();
  await firestore.collection('customers').doc(customerId).update({
    isDeleted: true,
    deletedAt: now,
    deletedBy: deletedByUid,
    updatedAt: now,
  });
  return true;
}

export async function restoreCustomer(customerId: string): Promise<boolean> {
  const firestore = getFirestoreServerInstance();
  const ref = firestore.collection('customers').doc(customerId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const customer = snap.data() as Customer;
  if (!isWithinRecoveryWindow(customer.deletedAt)) {
    throw new Error(`Cannot restore customer: ${RECOVERY_WINDOW_DAYS}-day recovery window expired.`);
  }
  const now = new Date().toISOString();
  await ref.update({
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    updatedAt: now,
  });
  return true;
}

// ============================================================================
// 4. MEMBERS & CREW (ERP)
// ============================================================================

export async function getMembersByStudio(studioId: string): Promise<StudioMember[]> {
  const firestore = getFirestoreServerInstance();
  const snap = await firestore
    .collection('members')
    .where('studioId', '==', studioId.toLowerCase())
    .get();
  return snap.docs
    .map((d) => d.data() as StudioMember)
    .filter((m) => !m.isDeleted);
}

export async function getDeletedMembersByStudio(studioId: string): Promise<StudioMember[]> {
  const firestore = getFirestoreServerInstance();
  const snap = await firestore
    .collection('members')
    .where('studioId', '==', studioId.toLowerCase())
    .get();
  return snap.docs
    .map((d) => d.data() as StudioMember)
    .filter((m) => !!m.isDeleted);
}

export async function getMemberById(memberId: string): Promise<StudioMember | null> {
  const firestore = getFirestoreServerInstance();
  const doc = await firestore.collection('members').doc(memberId).get();
  if (doc.exists) {
    const member = doc.data() as StudioMember;
    if (member.isDeleted) return null;
    return member;
  }
  return null;
}

export async function getMemberByIdIncludeDeleted(memberId: string): Promise<StudioMember | null> {
  const firestore = getFirestoreServerInstance();
  const doc = await firestore.collection('members').doc(memberId).get();
  if (doc.exists) return doc.data() as StudioMember;
  return null;
}

export async function saveMember(member: StudioMember): Promise<StudioMember> {
  const firestore = getFirestoreServerInstance();
  await firestore.collection('members').doc(member.id).set(member, { merge: true });
  return member;
}

export async function updateMember(memberId: string, updates: Partial<StudioMember>): Promise<StudioMember | null> {
  const firestore = getFirestoreServerInstance();
  const ref = firestore.collection('members').doc(memberId);
  await ref.update({ ...updates, updatedAt: new Date().toISOString() });
  const snap = await ref.get();
  return snap.exists ? (snap.data() as StudioMember) : null;
}

export async function softDeleteMember(memberId: string, deletedByUid: string): Promise<boolean> {
  const firestore = getFirestoreServerInstance();
  const now = new Date().toISOString();
  await firestore.collection('members').doc(memberId).update({
    isDeleted: true,
    status: 'INACTIVE',
    deletedAt: now,
    deletedBy: deletedByUid,
    updatedAt: now,
  });
  return true;
}

export async function restoreMember(memberId: string): Promise<boolean> {
  const firestore = getFirestoreServerInstance();
  const ref = firestore.collection('members').doc(memberId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const member = snap.data() as StudioMember;
  if (!isWithinRecoveryWindow(member.deletedAt)) {
    throw new Error(`Cannot restore crew member: ${RECOVERY_WINDOW_DAYS}-day recovery window expired.`);
  }
  const now = new Date().toISOString();
  await ref.update({
    isDeleted: false,
    status: 'ACTIVE',
    deletedAt: null,
    deletedBy: null,
    updatedAt: now,
  });
  return true;
}

// ============================================================================
// 5. TASKS
// ============================================================================

export async function getTasksByOrder(orderId: string): Promise<Task[]> {
  const firestore = getFirestoreServerInstance();
  const snap = await firestore
    .collection('tasks')
    .where('orderId', '==', orderId)
    .get();
  const tasks = snap.docs
    .map((d) => d.data() as Task)
    .filter((t) => !t.isDeleted);
  return tasks.sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));
}

export async function getTasksByStudio(studioId: string): Promise<Task[]> {
  const firestore = getFirestoreServerInstance();
  const snap = await firestore
    .collection('tasks')
    .where('studioId', '==', studioId.toLowerCase())
    .get();
  return snap.docs
    .map((d) => d.data() as Task)
    .filter((t) => !t.isDeleted);
}

export async function getTasksByMember(studioId: string, memberId: string): Promise<Task[]> {
  const firestore = getFirestoreServerInstance();
  const snap = await firestore
    .collection('tasks')
    .where('studioId', '==', studioId.toLowerCase())
    .where('assignedMemberId', '==', memberId)
    .get();
  return snap.docs
    .map((d) => d.data() as Task)
    .filter((task) => !task.isDeleted);
}

export async function getTaskById(taskId: string): Promise<Task | null> {
  const firestore = getFirestoreServerInstance();
  const doc = await firestore.collection('tasks').doc(taskId).get();
  if (doc.exists) {
    const task = doc.data() as Task;
    if (task.isDeleted) return null;
    return task;
  }
  return null;
}

export async function getTaskByIdIncludeDeleted(taskId: string): Promise<Task | null> {
  const firestore = getFirestoreServerInstance();
  const doc = await firestore.collection('tasks').doc(taskId).get();
  if (doc.exists) return doc.data() as Task;
  return null;
}

export async function saveTasks(tasks: Task[]): Promise<Task[]> {
  const firestore = getFirestoreServerInstance();
  const batch = firestore.batch();
  tasks.forEach((t) => {
    const ref = firestore.collection('tasks').doc(t.id);
    batch.set(ref, t, { merge: true });
  });
  await batch.commit();
  return tasks;
}

export async function saveTask(task: Task): Promise<Task> {
  const firestore = getFirestoreServerInstance();
  await firestore.collection('tasks').doc(task.id).set(task, { merge: true });
  return task;
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<Task | null> {
  const firestore = getFirestoreServerInstance();
  const ref = firestore.collection('tasks').doc(taskId);
  await ref.update({ ...updates, updatedAt: new Date().toISOString() });
  const snap = await ref.get();
  return snap.exists ? (snap.data() as Task) : null;
}

export async function softDeleteTask(taskId: string, deletedByUid: string): Promise<boolean> {
  const firestore = getFirestoreServerInstance();
  const now = new Date().toISOString();
  await firestore.collection('tasks').doc(taskId).update({
    isDeleted: true,
    deletedAt: now,
    deletedBy: deletedByUid,
    updatedAt: now,
  });
  return true;
}

export async function restoreTask(taskId: string): Promise<boolean> {
  const firestore = getFirestoreServerInstance();
  const ref = firestore.collection('tasks').doc(taskId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const task = snap.data() as Task;
  if (!isWithinRecoveryWindow(task.deletedAt)) {
    throw new Error(`Cannot restore task: ${RECOVERY_WINDOW_DAYS}-day recovery window expired.`);
  }
  const now = new Date().toISOString();
  await ref.update({
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    updatedAt: now,
  });
  return true;
}

// ============================================================================
// 6. INVITATIONS & ONBOARDING
// ============================================================================

export async function saveInvitation(invitation: StudioInvitation): Promise<StudioInvitation> {
  const firestore = getFirestoreServerInstance();
  const invitationRef = firestore.collection('invitations').doc(invitation.id);
  await firestore.runTransaction(async (transaction) => {
    const existing = await transaction.get(invitationRef);
    if (existing.exists) {
      throw new Error('Invitation code collision. Generate a new code and retry.');
    }
    transaction.create(invitationRef, invitation);
  });
  return invitation;
}

export async function updatePendingInvitationLinkTokenHash(code: string, tokenHash: string): Promise<void> {
  const firestore = getFirestoreServerInstance();
  const invitationRef = firestore.collection('invitations').doc(code.trim().toUpperCase());
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(invitationRef);
    if (!snapshot.exists) throw new Error('Invitation not found.');
    const invitation = snapshot.data() as StudioInvitation;
    if (invitation.status !== 'PENDING' || invitation.isDeleted || invitation.claimLocked) {
      throw new Error('This invitation cannot issue a new link. Revoke it and create a replacement.');
    }
    transaction.update(invitationRef, {
      claimLinkTokenHash: tokenHash,
      updatedAt: new Date().toISOString(),
    });
  });
}

export async function getInvitationByCode(code: string): Promise<StudioInvitation | null> {
  const cleanCode = code.trim().toUpperCase();
  const firestore = getFirestoreServerInstance();
  const doc = await firestore.collection('invitations').doc(cleanCode).get();
  if (doc.exists) {
    const invite = doc.data() as StudioInvitation;
    if (invite.isDeleted || invite.status === 'REVOKED') return null;
    return invite;
  }
  return null;
}

export async function getInvitationByCodeIncludeDeleted(code: string): Promise<StudioInvitation | null> {
  const cleanCode = code.trim().toUpperCase();
  const firestore = getFirestoreServerInstance();
  const doc = await firestore.collection('invitations').doc(cleanCode).get();
  return doc.exists ? (doc.data() as StudioInvitation) : null;
}

export async function getInvitationsByStudio(studioId: string): Promise<StudioInvitation[]> {
  const firestore = getFirestoreServerInstance();
  const snap = await firestore
    .collection('invitations')
    .where('studioId', '==', studioId.toLowerCase())
    .get();
  return snap.docs
    .map((d) => d.data() as StudioInvitation)
    .filter((inv) => !inv.isDeleted && inv.status !== 'REVOKED');
}

export async function getPendingInvitationsByEmail(email: string): Promise<StudioInvitation[]> {
  const firestore = getFirestoreServerInstance();
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return [];
  const snap = await firestore
    .collection('invitations')
    .where('email', '==', normalizedEmail)
    .where('status', '==', 'PENDING')
    .get();
  return snap.docs
    .map((doc) => doc.data() as StudioInvitation)
    .filter((invitation) => !invitation.isDeleted && !invitation.claimLocked);
}

export async function recordInvitationPasscodeFailure(code: string): Promise<{
  locked: boolean;
  attemptsRemaining: number;
}> {
  const firestore = getFirestoreServerInstance();
  const cleanCode = code.trim().toUpperCase();
  const invitationRef = firestore.collection('invitations').doc(cleanCode);

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(invitationRef);
    if (!snapshot.exists) return { locked: false, attemptsRemaining: 0 };

    const invitation = snapshot.data() as StudioInvitation;
    if (invitation.status !== 'PENDING' || invitation.isDeleted || invitation.claimLocked) {
      return { locked: true, attemptsRemaining: 0 };
    }

    const failedAttempts = (invitation.failedClaimAttempts || 0) + 1;
    const locked = failedAttempts >= 5;
    transaction.update(invitationRef, {
      failedClaimAttempts: failedAttempts,
      claimLocked: locked,
      updatedAt: new Date().toISOString(),
    });
    return { locked, attemptsRemaining: Math.max(0, 5 - failedAttempts) };
  });
}

export async function revokeInvitation(code: string, revokedByUid: string): Promise<boolean> {
  const firestore = getFirestoreServerInstance();
  const cleanCode = code.trim().toUpperCase();
  const now = new Date().toISOString();
  await firestore.collection('invitations').doc(cleanCode).update({
    status: 'REVOKED',
    isDeleted: true,
    deletedAt: now,
    deletedBy: revokedByUid,
  });
  return true;
}

export async function restoreInvitation(code: string): Promise<boolean> {
  const firestore = getFirestoreServerInstance();
  const cleanCode = code.trim().toUpperCase();
  const docRef = firestore.collection('invitations').doc(cleanCode);
  const snap = await docRef.get();
  if (!snap.exists) return false;
  const invite = snap.data() as StudioInvitation;
  if (!isWithinRecoveryWindow(invite.deletedAt)) {
    throw new Error(`Cannot restore invitation: ${RECOVERY_WINDOW_DAYS}-day recovery window expired.`);
  }
  const now = new Date().toISOString();
  await docRef.update({
    status: 'PENDING',
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    updatedAt: now,
  });
  return true;
}

export async function acceptInvitationTransaction(input: {
  code: string;
  uid: string;
  userEmail: string;
  userName?: string;
  claimCodeVerified?: boolean;
}): Promise<{
  success: boolean;
  membership?: StudioMembership;
  studioId?: string;
  studioName?: string;
  error?: string;
}> {
  const firestore = getFirestoreServerInstance();
  const cleanCode = input.code.trim().toUpperCase();

  try {
    const result = await firestore.runTransaction(async (transaction) => {
      const inviteRef = firestore.collection('invitations').doc(cleanCode);
      const inviteDoc = await transaction.get(inviteRef);

      if (!inviteDoc.exists) {
        throw new Error(`Invitation code "${cleanCode}" was not found.`);
      }

      const invitation = inviteDoc.data() as StudioInvitation;

      if (invitation.isDeleted || invitation.status === 'REVOKED') {
        throw new Error('This invitation has been revoked or deleted.');
      }

      const studioId = invitation.studioId.toLowerCase();
      const membershipId = `${studioId}_${input.uid}`;
      const membershipRef = firestore.collection('memberships').doc(membershipId);

      if (invitation.status === 'ACCEPTED') {
        const existingMembershipDoc = await transaction.get(membershipRef);
        if (
          invitation.acceptedByUid === input.uid
          && existingMembershipDoc.exists
          && (existingMembershipDoc.data() as StudioMembership).status === 'ACTIVE'
        ) {
          return {
            membership: existingMembershipDoc.data() as StudioMembership,
            studioId,
            studioName: invitation.studioName,
          };
        }
        throw new Error('This invitation has already been claimed.');
      }

      if (invitation.status !== 'PENDING') {
        throw new Error('This invitation is no longer available.');
      }
      if (invitation.claimLocked) {
        throw new Error('This invitation is locked after too many incorrect passcode attempts. Ask the studio owner to create a new invitation.');
      }
      if (!invitation.email?.trim() && !input.claimCodeVerified) {
        throw new Error('The studio owner’s six-digit passcode is required for this invitation.');
      }

      if (invitation.email && invitation.email.trim()) {
        const invitedEmail = invitation.email.trim().toLowerCase();
        const authedEmail = input.userEmail.trim().toLowerCase();
        if (invitedEmail !== authedEmail) {
          throw new Error(
            `This invitation was issued to ${invitation.email}. Please sign in with that Google account.`
          );
        }
      }

      const normalizedEmail = input.userEmail.trim().toLowerCase();
      const existingMembersQuery = await transaction.get(
        firestore.collection('members')
          .where('studioId', '==', studioId)
          .where('email', '==', normalizedEmail)
          .limit(1)
      );
      const now = new Date().toISOString();

      const membership: StudioMembership = {
        id: membershipId,
        studioId,
        studioName: invitation.studioName,
        uid: input.uid,
        role: invitation.role || 'STUDIO_MEMBER',
        skills: invitation.skills || [],
        status: 'ACTIVE',
        joinedAt: now,
        updatedAt: now,
      };

      const googleName = input.userName?.trim() || "";
      const ownerName = invitation.name?.trim() || "";
      const primaryName = googleName || ownerName || normalizedEmail.split('@')[0];
      const ownerAssignedName = (ownerName && (!googleName || ownerName.toLowerCase() !== googleName.toLowerCase())) ? ownerName : undefined;

      // All transaction reads complete before any writes.
      if (!existingMembersQuery.empty) {
        const existingMemberRef = existingMembersQuery.docs[0].ref;
        const existingMember = existingMembersQuery.docs[0].data() as StudioMember;
        const priorOwnerName = ownerName || existingMember.ownerAssignedName || (existingMember.name !== googleName ? existingMember.name : "");
        const resolvedOwnerAssignedName = (priorOwnerName && priorOwnerName.toLowerCase() !== primaryName.toLowerCase()) ? priorOwnerName : undefined;
        transaction.update(existingMemberRef, {
          name: primaryName,
          ...(resolvedOwnerAssignedName ? { ownerAssignedName: resolvedOwnerAssignedName } : {}),
          email: normalizedEmail,
          ...(invitation.phone ? { phone: invitation.phone } : {}),
          skills: invitation.skills || existingMember.skills,
          status: 'ACTIVE',
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          updatedAt: now,
        });
      } else {
        const memberRef = firestore.collection('members').doc();
        const newMember: StudioMember = {
          id: memberRef.id,
          studioId,
          name: primaryName,
          ...(ownerAssignedName ? { ownerAssignedName } : {}),
          email: normalizedEmail,
          ...(invitation.phone ? { phone: invitation.phone } : {}),
          skills: invitation.skills || [],
          status: 'ACTIVE',
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        };
        transaction.set(memberRef, newMember);
      }

      transaction.update(inviteRef, {
        status: 'ACCEPTED',
        acceptedAt: now,
        acceptedByUid: input.uid,
      });
      transaction.set(membershipRef, membership, { merge: true });

      return { membership, studioId, studioName: invitation.studioName };
    });

    return {
      success: true,
      membership: result.membership,
      studioId: result.studioId,
      studioName: result.studioName,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to accept invitation.',
    };
  }
}

// ============================================================================
// 7. MARKETPLACE PROFILES
// ============================================================================

export async function getMarketplaceProfile(studioId: string): Promise<MarketplaceProfile | null> {
  const db = getFirestoreServerInstance();
  const doc = await db.collection('marketplace_profiles').doc(studioId).get();
  if (!doc.exists) return null;
  const profile = doc.data() as MarketplaceProfile;
  if (profile.isDeleted) return null;
  return profile;
}

export async function getMarketplaceProfileBySlug(slug: string): Promise<MarketplaceProfile | null> {
  const db = getFirestoreServerInstance();
  const snapshot = await db
    .collection('marketplace_profiles')
    .where('slug', '==', slug)
    .where('isVisible', '==', true)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  const profile = snapshot.docs[0].data() as MarketplaceProfile;
  if (profile.isDeleted) return null;
  return profile;
}

export async function upsertMarketplaceProfile(
  studioId: string,
  profileData: Partial<Omit<MarketplaceProfile, 'id' | 'studioId' | 'verifiedMetrics' | 'createdAt' | 'updatedAt'>>
): Promise<MarketplaceProfile> {
  const db = getFirestoreServerInstance();
  const docRef = db.collection('marketplace_profiles').doc(studioId);

  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    const now = new Date().toISOString();

    if (doc.exists) {
      const existing = doc.data() as MarketplaceProfile;
      const updated: MarketplaceProfile = {
        ...existing,
        ...profileData,
        isDeleted: false,
        updatedAt: now,
      };
      transaction.update(docRef, { ...updated });
      return updated;
    } else {
      const studioDoc = await transaction.get(db.collection('studios').doc(studioId));
      if (!studioDoc.exists) throw new Error('Studio not found');
      const studioData = studioDoc.data() as Studio;

      const newProfile: MarketplaceProfile = {
        id: studioId,
        studioId,
        name: profileData.name || studioData.name,
        slug: studioData.id,
        city: profileData.city || studioData.city,
        description: profileData.description || '',
        tags: profileData.tags || [],
        coverImageUrl: profileData.coverImageUrl || '',
        logoUrl: profileData.logoUrl || studioData.logoUrl || '',
        isVisible: profileData.isVisible ?? false,
        isDeleted: false,
        verifiedMetrics: {
          onTimeDeliveryPercentage: 100,
          completedOrdersCount: 0,
          lastCalculatedAt: now,
        },
        createdAt: now,
        updatedAt: now,
      };
      transaction.set(docRef, newProfile);
      return newProfile;
    }
  });
}

export async function softDeleteMarketplaceProfile(studioId: string, deletedByUid: string): Promise<boolean> {
  const db = getFirestoreServerInstance();
  const now = new Date().toISOString();
  await db.collection('marketplace_profiles').doc(studioId).update({
    isVisible: false,
    isDeleted: true,
    deletedAt: now,
    deletedBy: deletedByUid,
    updatedAt: now,
  });
  return true;
}

export async function restoreMarketplaceProfile(studioId: string): Promise<boolean> {
  const db = getFirestoreServerInstance();
  const docRef = db.collection('marketplace_profiles').doc(studioId);
  const doc = await docRef.get();
  if (!doc.exists) return false;
  const profile = doc.data() as MarketplaceProfile;
  if (!isWithinRecoveryWindow(profile.deletedAt)) {
    throw new Error(`Cannot restore marketplace profile: ${RECOVERY_WINDOW_DAYS}-day recovery window expired.`);
  }
  const now = new Date().toISOString();
  await docRef.update({
    isVisible: true,
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    updatedAt: now,
  });
  return true;
}

export async function searchMarketplaceProfiles(
  filters: { city?: string; tags?: string[] },
  limitCount = 50
): Promise<MarketplaceProfile[]> {
  const db = getFirestoreServerInstance();
  let query: FirebaseFirestore.Query = db
    .collection('marketplace_profiles')
    .where('isVisible', '==', true);

  if (filters.tags && filters.tags.length > 0) {
    query = query.where('tags', 'array-contains-any', filters.tags);
  }

  const snapshot = await query.limit(limitCount).get();
  const searchCity = filters.city?.trim().toLowerCase();

  return snapshot.docs
    .map((doc) => doc.data() as MarketplaceProfile)
    .filter((profile) => !profile.isDeleted)
    .filter((profile) => {
      if (!searchCity) return true;
      const profileCity = (profile.city || "").trim().toLowerCase();
      return profileCity.includes(searchCity) || searchCity.includes(profileCity);
    });
}

// ============================================================================
// 8. STUDIO PACKAGES
// ============================================================================

export async function getStudioPackages(studioId: string): Promise<StudioPackage[]> {
  const db = getFirestoreServerInstance();
  const snapshot = await db
    .collection('studio_packages')
    .where('studioId', '==', studioId.toLowerCase())
    .get();

  return snapshot.docs
    .map(d => d.data() as StudioPackage)
    .filter(p => !p.isDeleted);
}

export async function getPublishedStudioPackages(studioId: string): Promise<StudioPackage[]> {
  const db = getFirestoreServerInstance();
  const snapshot = await db
    .collection('studio_packages')
    .where('studioId', '==', studioId.toLowerCase())
    .where('isPublished', '==', true)
    .get();

  return snapshot.docs
    .map(d => d.data() as StudioPackage)
    .filter(p => !p.isDeleted);
}

export async function saveStudioPackage(pkg: StudioPackage): Promise<void> {
  const db = getFirestoreServerInstance();
  await db.collection('studio_packages').doc(pkg.id).set(pkg);
}

export async function updateStudioPackage(
  packageId: string,
  updates: Partial<Omit<StudioPackage, 'id' | 'studioId' | 'createdAt'>>
): Promise<StudioPackage | null> {
  const db = getFirestoreServerInstance();
  const ref = db.collection('studio_packages').doc(packageId);
  const doc = await ref.get();
  if (!doc.exists) return null;

  const existing = doc.data() as StudioPackage;
  const updated: StudioPackage = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await ref.update({ ...updated });
  return updated;
}

export async function softDeleteStudioPackage(packageId: string, deletedByUid: string): Promise<boolean> {
  const db = getFirestoreServerInstance();
  const now = new Date().toISOString();
  await db.collection('studio_packages').doc(packageId).update({
    isDeleted: true,
    isPublished: false,
    deletedAt: now,
    deletedBy: deletedByUid,
    updatedAt: now,
  });
  return true;
}

// ============================================================================
// 9. BOOKING REQUESTS & LEADS
// ============================================================================

export async function createBookingRequest(req: BookingRequest): Promise<void> {
  const db = getFirestoreServerInstance();
  await db.collection('booking_requests').doc(req.id).set(req);
}

export async function getBookingRequestById(id: string): Promise<BookingRequest | null> {
  const db = getFirestoreServerInstance();
  const doc = await db.collection('booking_requests').doc(id).get();
  if (!doc.exists) return null;
  const req = doc.data() as BookingRequest;
  if (req.isDeleted) return null;
  return req;
}

export async function getBookingRequestsByStudio(studioId: string): Promise<BookingRequest[]> {
  const db = getFirestoreServerInstance();
  const snapshot = await db
    .collection('booking_requests')
    .where('studioId', '==', studioId.toLowerCase())
    .get();

  return snapshot.docs
    .map(d => d.data() as BookingRequest)
    .filter(r => !r.isDeleted)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getBookingRequestsByCustomer(customerId: string): Promise<BookingRequest[]> {
  const db = getFirestoreServerInstance();
  const snapshot = await db
    .collection('booking_requests')
    .where('customerId', '==', customerId)
    .get();

  return snapshot.docs
    .map(d => d.data() as BookingRequest)
    .filter(r => !r.isDeleted)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function updateBookingRequest(
  id: string,
  updates: Partial<Omit<BookingRequest, 'id' | 'studioId' | 'createdAt'>>
): Promise<BookingRequest | null> {
  const db = getFirestoreServerInstance();
  const ref = db.collection('booking_requests').doc(id);
  const doc = await ref.get();
  if (!doc.exists) return null;

  const existing = doc.data() as BookingRequest;
  const updated: BookingRequest = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await ref.update({ ...updated });
  return updated;
}

// ============================================================================
// 10. PAYMENTS & VERIFICATION
// ============================================================================

export async function savePaymentRecord(payment: PaymentRecord): Promise<void> {
  const db = getFirestoreServerInstance();
  await db.collection('payments').doc(payment.id).set(payment);
}

export async function getPaymentById(paymentId: string): Promise<PaymentRecord | null> {
  const db = getFirestoreServerInstance();
  const doc = await db.collection('payments').doc(paymentId).get();
  if (!doc.exists) return null;
  const p = doc.data() as PaymentRecord;
  if (p.isDeleted) return null;
  return p;
}

export async function getPaymentsByOrder(orderId: string): Promise<PaymentRecord[]> {
  const db = getFirestoreServerInstance();
  const snapshot = await db
    .collection('payments')
    .where('orderId', '==', orderId)
    .get();

  return snapshot.docs
    .map(d => d.data() as PaymentRecord)
    .filter(p => !p.isDeleted);
}

export async function getPaymentsByStudio(studioId: string): Promise<PaymentRecord[]> {
  const db = getFirestoreServerInstance();
  const snapshot = await db
    .collection('payments')
    .where('studioId', '==', studioId.toLowerCase())
    .get();

  return snapshot.docs
    .map(d => d.data() as PaymentRecord)
    .filter(p => !p.isDeleted)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function updatePaymentVerification(
  paymentId: string,
  verified: boolean,
  verifiedByUid: string,
  rejectionReason?: string
): Promise<PaymentRecord | null> {
  const db = getFirestoreServerInstance();
  const ref = db.collection('payments').doc(paymentId);
  const doc = await ref.get();
  if (!doc.exists) return null;

  const existing = doc.data() as PaymentRecord;
  const now = new Date().toISOString();

  const updated: PaymentRecord = {
    ...existing,
    status: verified ? 'PAID' : 'PENDING',
    verificationStatus: verified ? 'VERIFIED' : 'REJECTED',
    verifiedBy: verifiedByUid,
    verifiedAt: now,
    rejectionReason: rejectionReason || undefined,
    updatedAt: now,
  };

  await ref.update({ ...updated });
  return updated;
}

// ============================================================================
// 11. CUSTOMER ORDER HISTORY
// ============================================================================

export async function getCustomerOrdersHistory(customerId: string): Promise<Order[]> {
  const db = getFirestoreServerInstance();
  const snapshot = await db
    .collection('orders')
    .where('customer.id', '==', customerId)
    .get();

  return snapshot.docs
    .map(d => d.data() as Order)
    .filter(o => !o.isDeleted)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ============================================================================
// 12. STUDIO PLANS & ENTITLEMENTS
// ============================================================================

export * from './studioPlan';

// ============================================================================
// 13. PLATFORM PUBLIC STATS
// ============================================================================

export interface PlatformPublicStats {
  marketplaceStudiosCount: number;
  marketplaceLeadsCount: number;
  activeStudiosCount: number;
  registeredOrdersCount: number;
}

export async function getPlatformPublicStats(): Promise<PlatformPublicStats> {
  try {
    const db = getFirestoreServerInstance();
    const [marketplaceSnap, leadsSnap, studiosSnap, ordersSnap] = await Promise.all([
      db.collection('marketplace_profiles').where('isVisible', '==', true).count().get().catch(() => ({ data: () => ({ count: 0 }) })),
      db.collection('booking_requests').count().get().catch(() => ({ data: () => ({ count: 0 }) })),
      db.collection('studios').where('isDeleted', '==', false).count().get().catch(() => ({ data: () => ({ count: 0 }) })),
      db.collection('orders').where('isDeleted', '==', false).count().get().catch(() => ({ data: () => ({ count: 0 }) })),
    ]);

    return {
      marketplaceStudiosCount: marketplaceSnap.data().count,
      marketplaceLeadsCount: leadsSnap.data().count,
      activeStudiosCount: studiosSnap.data().count,
      registeredOrdersCount: ordersSnap.data().count,
    };
  } catch (err) {
    console.warn('[getPlatformPublicStats] Error querying stats:', err);
    return {
      marketplaceStudiosCount: 0,
      marketplaceLeadsCount: 0,
      activeStudiosCount: 0,
      registeredOrdersCount: 0,
    };
  }
}

// ============================================================================
// 14. OMNICHANNEL STUDIO LEADS (INSTAGRAM, WHATSAPP, WEBSITE, MARKETPLACE)
// ============================================================================

export async function saveStudioLead(lead: StudioLead): Promise<StudioLead> {
  const db = getFirestoreServerInstance();
  const normalized: StudioLead = {
    ...lead,
    studioId: lead.studioId.toLowerCase(),
    isDeleted: Boolean(lead.isDeleted),
  };
  await db.collection('leads').doc(normalized.id).set(normalized, { merge: true });
  return normalized;
}

export async function getLeadsByStudio(studioId: string): Promise<StudioLead[]> {
  const db = getFirestoreServerInstance();
  const snap = await db
    .collection('leads')
    .where('studioId', '==', studioId.toLowerCase())
    .get();
  return snap.docs
    .map((d) => d.data() as StudioLead)
    .filter((l) => !l.isDeleted)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getLeadById(leadId: string): Promise<StudioLead | null> {
  const db = getFirestoreServerInstance();
  const doc = await db.collection('leads').doc(leadId).get();
  if (!doc.exists) return null;
  const lead = doc.data() as StudioLead;
  return lead.isDeleted ? null : lead;
}

export async function updateStudioLead(
  leadId: string,
  updates: Partial<StudioLead>
): Promise<StudioLead | null> {
  const db = getFirestoreServerInstance();
  const ref = db.collection('leads').doc(leadId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const existing = snap.data() as StudioLead;
  const updated: StudioLead = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await ref.set(updated, { merge: true });
  return updated;
}




export * from './billing';
