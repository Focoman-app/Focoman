"use client";

import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { firebaseApp } from "@/lib/firebase";

const MAX_PROOF_BYTES = 5 * 1024 * 1024;

/** Uploads a real UPI screenshot. Callers must persist the returned URL only after success. */
export async function uploadPaymentProof(input: {
  studioId: string;
  orderId: string;
  paymentId: string;
  file: File;
}): Promise<string> {
  if (!input.file.type.startsWith("image/")) throw new Error("Payment proof must be an image file.");
  if (input.file.size > MAX_PROOF_BYTES) throw new Error("Payment proof image must be 5 MB or smaller.");
  const extension = input.file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "image";
  const path = `payment-proofs/${input.studioId.toLowerCase()}/${input.orderId}/${input.paymentId}/proof.${extension}`;
  const snapshot = await uploadBytes(ref(getStorage(firebaseApp), path), input.file, { contentType: input.file.type });
  return getDownloadURL(snapshot.ref);
}
