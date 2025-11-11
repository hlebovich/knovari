const FALLBACK_MIME_TYPE = "image/png";

export async function base64ImageToFile(base64Input: string, fileName: string): Promise<File> {
  const hasDataUrlHeader: boolean = base64Input.startsWith("data:");

  const dataUrl: string = hasDataUrlHeader
    ? base64Input
    : `data:${FALLBACK_MIME_TYPE};base64,${base64Input}`;

  const response: Response = await fetch(dataUrl);
  const blob: Blob = await response.blob();

  const mimeType: string = hasDataUrlHeader && blob.type ? blob.type : FALLBACK_MIME_TYPE;

  return new File([blob], fileName, { type: mimeType });
}
