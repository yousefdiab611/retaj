import qrcode from "qrcode-generator";

function base64Encode(text: string): string {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return window.btoa(unescape(encodeURIComponent(text)));
  }
  return Buffer.from(text, "utf-8").toString("base64");
}

export function generateQrCodeDataUrl(value: string): string {
  const qr = qrcode(0, "L");
  qr.addData(value);
  qr.make();
  const svg = qr.createSvgTag(4, 0);
  return `data:image/svg+xml;base64,${base64Encode(svg)}`;
}
