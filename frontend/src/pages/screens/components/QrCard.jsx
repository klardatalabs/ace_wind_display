// The QR that opens /ask/<screen> on a visitor's phone. Pulses gently to draw the eye.

import { QRCodeSVG } from "qrcode.react";
import Icon from "../../../components/ui/Icon.jsx";
import { usePublicOrigin } from "../../../hooks/usePublicOrigin.js";

export default function QrCard({ screenKey, label, hint, skin, className = "" }) {
  const origin = usePublicOrigin();
  const url = `${origin}/ask/${screenKey}`;
  return (
    <div className={`flex items-center gap-[1.6vmin] rounded-[2.4vmin] p-[1.6vmin] ${skin.card} ${className}`}>
      <div className="qr-pulse rounded-[1.4vmin] bg-white p-[1vmin]">
        <QRCodeSVG value={url} size={256} level="M" fgColor="#06211a" bgColor="#ffffff" className="block size-[clamp(96px,15vmin,320px)]" />
      </div>
      <div className="max-w-[22vmin]">
        <p className={`flex items-center gap-[0.6vmin] font-display text-[clamp(16px,2.4vmin,46px)] leading-tight font-semibold ${skin.text}`}>
          <Icon name="commentDots" className="size-[1.1em]" />
          {label}
        </p>
        <p className={`mt-[0.6vmin] text-[clamp(11px,1.35vmin,26px)] leading-snug ${skin.muted}`}>{hint}</p>
        <p className={`mt-[0.8vmin] font-mono text-[clamp(10px,1.1vmin,20px)] break-all ${skin.accent}`}>{url.replace(/^https?:\/\//, "")}</p>
      </div>
    </div>
  );
}
