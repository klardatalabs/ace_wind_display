export default function Panel({ title, icon, action, children, className = "" }) {
  return (
    <section className={`rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgb(6_33_26/0.06)] ring-1 ring-moss-100 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-moss-950">
            {icon}
            {title}
          </h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
