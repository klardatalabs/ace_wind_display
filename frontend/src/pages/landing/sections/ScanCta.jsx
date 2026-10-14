// Closing band: the same QR the hoardings show, so desktop visitors can try it on their phone.

import { QRCodeSVG } from "qrcode.react";
import Button from "../../../components/ui/Button.jsx";
import Reveal from "../../../components/ui/Reveal.jsx";
import { usePublicOrigin } from "../../../hooks/usePublicOrigin.js";

export default function ScanCta() {
  const origin = usePublicOrigin();
  return (
    <section className="px-4 pt-12 md:px-6">
      <Reveal className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-10 overflow-hidden rounded-4xl bg-gradient-to-br from-moss-900 to-moss-950 p-10 text-white md:grid-cols-[1fr_auto] md:p-16">
        <div className="max-w-xl">
          <p className="text-sm font-medium text-moss-300">At the community centre — or right here</p>
          <h2 className="mt-3 font-display text-4xl leading-[1.05] font-medium tracking-display md:text-6xl">Scan. Chat. No login.</h2>
          <p className="mt-4 text-lg text-white/75">
            Point your phone camera at the code to talk to Ace. Your chat stays on your phone's browser tab — nobody else can see it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button to="/ask/community" variant="glass" size="lg" icon="arrowRight">
              Open chat here
            </Button>
          </div>
        </div>
        <div className="glass-ring mx-auto rounded-3xl bg-white p-5">
          <QRCodeSVG value={`${origin}/ask/community`} size={196} fgColor="#06211a" bgColor="#ffffff" level="M" />
        </div>
      </Reveal>
    </section>
  );
}
