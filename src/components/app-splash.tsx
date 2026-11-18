import Image from "next/image";
import { SnookerLoader } from "@/components/motion/snooker-loader";
import { IspaBrand } from "@/components/ispa-brand";

// Full-screen branded loading screen: while logging in, and on the first load
// of any page. No hooks, so it works from server and client components.
// variant "ispa": multi-location (ISPA) tournaments — no academy branding.
// variant "plain": just the spinner, for the moment before we know which.
export function AppSplash({
  message = "טוען...",
  variant = "academy",
}: {
  message?: string;
  variant?: "academy" | "ispa" | "plain";
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-6 bg-brand-gradient animate-fade-in"
    >
      {variant === "academy" && (
        <>
          <Image src="/logo.png" alt="" width={140} height={88} priority className="object-contain drop-shadow-lg" />
          <div className="text-center">
            <p className="bc-num text-2xl text-white">האקדמיה לסנוקר</p>
            <p className="text-sm text-white/70">של שחר רוברג</p>
          </div>
        </>
      )}
      {variant === "ispa" && <IspaBrand size="lg" />}
      <div className="text-white">
        <SnookerLoader size={20} label={message} />
      </div>
    </div>
  );
}
