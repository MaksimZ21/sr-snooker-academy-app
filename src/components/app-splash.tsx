import Image from "next/image";

// Full-screen branded loading screen: while logging in, and on the first load
// of any page. No hooks, so it works from server and client components.
export function AppSplash({ message = "טוען..." }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-6 bg-brand-gradient animate-fade-in"
    >
      <Image src="/logo.png" alt="" width={140} height={88} priority className="object-contain drop-shadow-lg" />
      <div className="text-center">
        <p className="text-xl font-bold text-white">האקדמיה לסנוקר</p>
        <p className="text-sm text-white/70">של שחר רוברג</p>
      </div>
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
      <p className="text-sm font-medium text-white/90">{message}</p>
    </div>
  );
}
