import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireGuest } from "@/lib/guest-session";
import { submitSuggestions } from "@/app/actions/guest";
import { Describe } from "@/components/guest/describe";

export const metadata: Metadata = { title: "Describe it" };

// G7: free text in, suggested service(s) out. The guest always confirms.
export default async function DescribePage() {
  await requireGuest();
  return (
    <div>
      <Link href="/guest" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted">
        <ChevronLeft className="size-4" aria-hidden="true" /> Back
      </Link>
      <Describe sendAll={submitSuggestions} />
    </div>
  );
}
