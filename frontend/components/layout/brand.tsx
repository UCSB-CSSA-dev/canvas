import Image from "next/image";
import logoMark from "@/assets/brand/logo-mark.webp";
import logoOnDark from "@/assets/brand/logo-on-dark.webp";
import { cn } from "@/lib/utils";

const FULL_NAME = "UCSB CSSA · Chinese Students and Scholars Association · 加州大学圣塔芭芭拉分校中国学生学者联合会";

/** Phoenix + "UCSB CSSA" wordmark followed by "Hub"; for headers and the sidebar. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      <Image src={logoMark} alt="UCSB CSSA" priority className="h-full w-auto" />
      <span className="text-base font-semibold text-primary">Hub</span>
    </span>
  );
}

/** Full logo with the association's names; for auth and landing screens. */
export function BrandLogo({ className }: { className?: string }) {
  return <Image src={logoOnDark} alt={FULL_NAME} priority className={cn("h-auto", className)} />;
}
