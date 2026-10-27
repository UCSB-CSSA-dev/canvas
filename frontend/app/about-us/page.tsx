import type { Metadata } from "next";
import { AboutPage } from "@/components/about/about-page";

export const metadata: Metadata = {
  title: "About us · UCSB CSSA",
  description: "UCSB 中国学生学者联谊会 (CSSA): who we are, what we do, and the team.",
};

/** Public page (no sign-in): introduction and member roster. */
export default function AboutUsPage() {
  return <AboutPage />;
}
