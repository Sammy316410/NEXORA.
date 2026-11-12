import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { listRequests } from "@/lib/requests";
import { departmentName } from "@/lib/labels";
import { ServiceIcon } from "@/components/icons";
import { ActionButton } from "@/components/client/action-button";
import { DueChip, TimeAgo, WaitingFlag } from "@/components/client/due-chip";
import { claimTask } from "@/app/actions/staff";

export const metadata: Metadata = { title: "Open pool" };

// S5: unassigned requests in my department that I can claim.
export default async function PoolPage() {
  const staff = await requireStaff();
  const pool = staff.department_id
    ? (await listRequests({ hotelId: staff.hotel_id, statuses: ["pending"], departmentId: staff.department_id, limit: 50 })).filter((r) => !r.assignee_id)
    : [];

  return (
    <div className="px-4 pt-5">
      <h1 className="font-display text-[26px] font-extrabold tracking-tight">Open pool</h1>
      <p className="mt-1 mb-4 text-sm text-muted">Unassigned {departmentName(staff.department_id).toLowerCase()} requests. Claim one and it&apos;s yours.</p>
      {pool.length === 0 ? (
        <div className="rounded-2xl bg-surface px-4 py-12 text-center font-display text-lg font-bold">Nothing waiting. Nice.</div>
      ) : (
        <div className="space-y-3">
          {pool.map((r) => (
            <article key={r.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start gap-4">
                <p className="min-w-[64px] font-display text-[34px] leading-none font-extrabold tabular-nums">{r.room?.number}</p>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-display text-[16px] font-bold">
                    <ServiceIcon icon={r.service?.icon} className="size-4 text-muted" /> {r.title}
                  </p>
                  <p className="text-[13px] text-muted">
                    {r.guest?.first_name ? `${r.guest.first_name} · ` : ""}
                    <TimeAgo at={r.created_at} />
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <WaitingFlag status={r.status} assigneeId={r.assignee_id} createdAt={r.created_at} />
                    <DueChip status={r.status} dueAt={r.due_at} />
                  </div>
                </div>
              </div>
              <ActionButton action={claimTask.bind(null, r.id)} size="lg" className="mt-3 w-full" pendingText="Claiming…">
                Claim
              </ActionButton>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
