import Image from "next/image";
import { SnookerLoader } from "@/components/motion/snooker-loader";

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
        <p className="bc-num text-2xl text-white">האקדמיה לסנוקר</p>
        <p className="text-sm text-white/70">של שחר רוברג</p>
      </div>
      <div className="text-white">
        <SnookerLoader size={20} label={message} />
      </div>
    </div>
  );
}
