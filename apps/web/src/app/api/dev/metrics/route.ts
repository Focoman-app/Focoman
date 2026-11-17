import { NextResponse } from 'next/server';
import { getFirestoreServerInstance } from '@focoman/db';
import type { Studio } from '@focoman/types';
import { requireDevPortalSession } from '@/lib/devPortalAuth';
import { getBrevoAccountStatus, getBrevoDailyUsageStats } from '@/services/brevoService';
import { getResendStatus } from '@/services/emailService';
import { getResendAccountStatus, getDomainExpirationInfo } from '@/services/resendDevService';
import { getR2ConfigStatus } from '@/services/r2StorageService';
import { GB_BYTES, resolveStudioStorageQuota } from '@/lib/storageQuota';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const R2_USD_PER_GB_MONTH = 0.015;
const R2_FREE_TIER_GB = 10;
const USD_TO_INR_RATE = 86;

/** Platform aggregates only. Never send documents or identifying fields to the client. */
export async function GET() {
  try {
    await requireDevPortalSession();
  } catch {
    return NextResponse.json({ error: 'Authentication required.' }, {
      status: 401,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  const emptyMetrics = {
    studioRecords: null,
    customerRecords: null,
    orderRecords: null,
    ordersThisMonth: null,
    verifiedPaymentRecords: null,
    pendingPaymentRecords: null,
    vasInquiriesCount: null,
  };

  try {
    const db = getFirestoreServerInstance();
    const r2Config = getR2ConfigStatus();
    const queries = [
      db.collection('studios').count().get(),
      db.collection('customers').count().get(),
      db.collection('orders').count().get(),
      db.collection('orders').where('createdAt', '>=', start).where('createdAt', '<', end).count().get(),
      db.collection('payments').where('verificationStatus', '==', 'VERIFIED').count().get(),
      db.collection('payments').where('verificationStatus', '==', 'PENDING_VERIFICATION').count().get(),
      db.collection('vas_inquiries').count().get(),
      db.collection('cloud_photos').count().get(),
    ];
    const [
      results,
      studiosSnap,
      vasLogsSnap,
      brevoAccount,
      brevoStats,
      resendStatus,
      resendAccount,
      domainExpiration,
    ] = await Promise.all([
      Promise.allSettled(queries),
      db.collection('studios').get().catch(() => null),
      db.collection('vas_inquiries').orderBy('createdAt', 'desc').limit(25).get().catch(() => null),
      getBrevoAccountStatus().catch(() => null),
      getBrevoDailyUsageStats().catch(() => null),
      Promise.resolve(getResendStatus()),
      getResendAccountStatus().catch(() => null),
      Promise.resolve(getDomainExpirationInfo()),
    ]);
    const count = (index: number): number | null => {
      const result = results[index];
      return result.status === 'fulfilled' ? result.value.data().count : null;
    };

    let totalUsedBytes = 0;
    let totalAllocatedBytes = 0;
    let totalFileCountFromStudios = 0;
    let studiosUsingStorage = 0;
    let studiosNearCap = 0;
    let studiosAtCap = 0;
    const planBreakdown = {
      free: 0,
      trial: 0,
      starter: 0,
      professional: 0,
    };

    if (studiosSnap) {
      for (const doc of studiosSnap.docs) {
        const s = doc.data() as Studio;
        if (s.isDeleted) continue;
        const quota = resolveStudioStorageQuota(s, now);
        totalUsedBytes += quota.usedBytes;
        totalAllocatedBytes += quota.limitBytes;
        totalFileCountFromStudios += quota.fileCount;
        if (quota.usedBytes > 0) studiosUsingStorage++;
        if (quota.isNearCap) studiosNearCap++;
        if (quota.isAtCap) studiosAtCap++;

        if (quota.planLabel === '30-Day Free Trial') planBreakdown.trial++;
        else if (quota.planLabel === 'Starter') planBreakdown.starter++;
        else if (quota.planLabel === 'Professional') planBreakdown.professional++;
        else planBreakdown.free++;
      }
    }

    const cloudPhotoCountQuery = count(7);
    const totalStoredPhotos =
      cloudPhotoCountQuery !== null
        ? Math.max(cloudPhotoCountQuery, totalFileCountFromStudios)
        : totalFileCountFromStudios;

    const totalUsedGb = Math.round((totalUsedBytes / GB_BYTES) * 1000) / 1000;
    const totalAllocatedGb = Math.round((totalAllocatedBytes / GB_BYTES) * 10) / 10;
    const billableUsedGb = Math.max(0, totalUsedGb - R2_FREE_TIER_GB);
    const estimatedMonthlyUsd =
      Math.round(billableUsedGb * R2_USD_PER_GB_MONTH * 100) / 100;
    const estimatedMonthlyInr =
      Math.round(estimatedMonthlyUsd * USD_TO_INR_RATE * 100) / 100;

    const billableAllocatedGb = Math.max(0, totalAllocatedGb - R2_FREE_TIER_GB);
    const maxAllocatedLiabilityUsd =
      Math.round(billableAllocatedGb * R2_USD_PER_GB_MONTH * 100) / 100;
    const maxAllocatedLiabilityInr =
      Math.round(maxAllocatedLiabilityUsd * USD_TO_INR_RATE * 100) / 100;

    const platformCapGb = r2Config.platformCapGb;
    const platformCapUsedPercent =
      platformCapGb > 0
        ? Math.min(100, Math.round((totalUsedGb / platformCapGb) * 1000) / 10)
        : 0;
    const capStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' =
      platformCapUsedPercent >= 90
        ? 'CRITICAL'
        : platformCapUsedPercent >= 75
        ? 'WARNING'
        : 'HEALTHY';

    const vasInquiryLogs = vasLogsSnap
      ? vasLogsSnap.docs.map((doc) => {
          const d = doc.data();
          return {
            id: d.id || doc.id,
            targetPhone: d.targetPhone || '8072333075',
            services: Array.isArray(d.services) ? d.services : ['Branding and Website', 'Data Migration'],
            sourcePage: d.sourcePage || '/',
            createdAt: d.createdAt || now.toISOString(),
          };
        })
      : [];

    return NextResponse.json({
      generatedAt: now.toISOString(),
      metrics: {
        studioRecords: count(0),
        customerRecords: count(1),
        orderRecords: count(2),
        ordersThisMonth: count(3),
        verifiedPaymentRecords: count(4),
        pendingPaymentRecords: count(5),
        vasInquiriesCount: count(6),
      },
      storage: {
        r2Configured: r2Config.configured,
        bucketName: r2Config.bucketName,
        hasPublicBaseUrl: r2Config.hasPublicBaseUrl,
        totalUsedBytes,
        totalUsedGb,
        totalAllocatedBytes,
        totalAllocatedGb,
        totalStoredPhotos,
        studiosUsingStorage,
        studiosNearCap,
        studiosAtCap,
        planBreakdown,
        costs: {
          usdPerGbMonth: R2_USD_PER_GB_MONTH,
          freeTierGb: R2_FREE_TIER_GB,
          usdToInrRate: USD_TO_INR_RATE,
          billableUsedGb: Math.round(billableUsedGb * 1000) / 1000,
          estimatedMonthlyUsd,
          estimatedMonthlyInr,
          maxAllocatedLiabilityUsd,
          maxAllocatedLiabilityInr,
          egressCostUsd: 0,
        },
        caps: {
          platformCapGb,
          platformCapUsedPercent,
          capStatus,
          maxPhotoMb: 10,
          maxPhotosPerOrder: 2000,
          tierCapsGb: {
            free: 0,
            trial: 10,
            starter: 20,
            professional: 50,
          },
        },
      },
      vasInquiryLogs,
      emailProviders: {
        brevo: {
          account: brevoAccount,
          stats: brevoStats,
        },
        resend: {
          ...resendStatus,
          account: resendAccount,
        },
      },
      domainExpiration,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ generatedAt: now.toISOString(), metrics: emptyMetrics, vasInquiryLogs: [] }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
