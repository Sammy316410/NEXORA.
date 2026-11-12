"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import type { RoomStatus } from "@/lib/types";
import { buttonClass, Input, Select } from "@/components/ui";
import { toast } from "@/components/client/toaster";

export function RoomStatusForm({ current, action }: { current: RoomStatus; action: (formData: FormData) => Promise<ActionResult> }) {
  const [status, setStatus] = useState<RoomStatus>(current);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="space-y-2"
      action={(fd) =>
        start(async () => {
          const r = await action(fd);
          if (!r.ok) toast(r.error, "error");
          else toast(r.message ?? "Room updated.", "success");
          router.refresh();
        })
      }
    >
      <div className="flex gap-2">
        <Select name="status" value={status} onChange={(e) => setStatus(e.target.value as RoomStatus)} className="h-10 flex-1 text-sm" aria-label="Room status">
          <option value="available">Available (VC)</option>
          <option value="occupied">Occupied (OC)</option>
          <option value="cleaning">Cleaning (VD)</option>
          <option value="maintenance">Maintenance (OOO)</option>
        </Select>
        <button type="submit" disabled={pending || status === current} className={buttonClass("primary", "md")}>
          Update
        </button>
      </div>
      {status === "maintenance" ? <Input name="note" required placeholder="Why is it out of order?" className="h-10 text-sm" /> : null}
    </form>
  );
}
