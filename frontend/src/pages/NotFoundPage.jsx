import Button from "../components/ui/Button.jsx";
import TurbineMark from "../components/brand/TurbineMark.jsx";

export default function NotFoundPage() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
      <TurbineMark className="size-20" spinWithLive={false} />
      <h1 className="font-display text-5xl font-medium tracking-display text-moss-950">Blown off course.</h1>
      <p className="text-moss-900/70">That page drifted away on the wind.</p>
      <Button to="/" icon="arrowRight">
        Back home
      </Button>
    </section>
  );
}
