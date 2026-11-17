import { notFound } from "next/navigation";
import { getOrderByPasskeyAction } from "@/actions/orderActions";
import { CloudPhotoGalleryClient } from "./CloudPhotoGalleryClient";

export const dynamic = "force-dynamic";

export default async function TrackOrderGalleryPage({
  params,
}: {
  params: Promise<{ passkey: string }>;
}) {
  const { passkey } = await params;
  const decodedPasskey = decodeURIComponent(passkey || "").trim();

  if (!decodedPasskey) {
    notFound();
  }

  const res = await getOrderByPasskeyAction(decodedPasskey);
  if (!res.success || !res.view) {
    notFound();
  }

  return <CloudPhotoGalleryClient view={res.view} rawIdentifier={decodedPasskey} />;
}
