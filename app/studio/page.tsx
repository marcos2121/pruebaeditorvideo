import type { Metadata } from "next";
import { Studio } from "@/components/studio/Studio";

export const metadata: Metadata = { title: "ScrollBreak Studio" };

export default function StudioPage() {
  return <Studio />;
}
