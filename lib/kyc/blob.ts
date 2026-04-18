/**
 * Vercel Blob helpers para imágenes KYC.
 *
 * Modelo de seguridad:
 *   - access: 'public' + addRandomSuffix (único soportado por v2)
 *   - URLs con 8 chars random + timestamp → inadivinables
 *   - Pathname estructurado (kyc/<correlation_id>/<kind>-<ts>.ext) para
 *     purgar por retention (deleteKycImage)
 *   - Nunca exponer URL al end user (solo al admin, vía un endpoint que
 *     chequee auth antes de hacer redirect)
 */

import { put, del } from "@vercel/blob";

export interface UploadedBlob {
  url: string;
  pathname: string;
  size: number;
  contentType: string;
}

export async function uploadKycImage(params: {
  correlationId: string;
  kind: "dni-anverso" | "dni-reverso" | "selfie" | "liveness-frame";
  frameIndex?: number;
  bytes: Buffer;
  contentType: string;
}): Promise<UploadedBlob> {
  const { correlationId, kind, frameIndex, bytes, contentType } = params;
  const ext = contentType.split("/")[1]?.split("+")[0] ?? "jpg";
  const suffix = frameIndex !== undefined ? `-${frameIndex}` : "";
  const pathname = `kyc/${correlationId}/${kind}${suffix}-${Date.now()}.${ext}`;

  const result = await put(pathname, bytes, {
    access: "public", // Vercel Blob v2 solo acepta public; seguridad via obscure paths
    contentType,
    addRandomSuffix: true,
    allowOverwrite: false,
  });

  return {
    url: result.url,
    pathname: result.pathname,
    size: bytes.length,
    contentType,
  };
}

export async function deleteKycImage(url: string): Promise<void> {
  try {
    await del(url);
  } catch (err) {
    console.warn("[kyc/blob] delete failed", url, err);
  }
}
