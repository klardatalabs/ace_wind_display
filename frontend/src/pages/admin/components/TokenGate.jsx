import { useState } from "react";

export default function TokenGate({ onSubmit }) {
  const [value, setValue] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-moss-950/40 p-6 backdrop-blur-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onSubmit(value.trim());
        }}
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
      >
        <h2 className="font-display text-xl font-semibold text-moss-950">Admin token</h2>
        <p className="mt-1 text-sm text-moss-900/70">This server protects the simulator. Enter the ADMIN_TOKEN from its .env file.</p>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-4 w-full rounded-xl px-3 py-2.5 ring-1 ring-moss-200 outline-none focus:ring-2 focus:ring-moss-400"
          placeholder="ADMIN_TOKEN"
        />
        <button type="submit" className="mt-4 w-full rounded-xl bg-moss-900 py-2.5 font-medium text-white hover:bg-moss-700">
          Unlock
        </button>
      </form>
    </div>
  );
}
