import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { departmentName, ROLE_LABEL } from "@/lib/labels";
import { signOut, setMyDuty } from "@/app/actions/staff";
import { Avatar } from "@/components/ui";
import { WorkpegMark } from "@/components/brand";
import { ActionButton } from "@/components/client/action-button";

export const metadata: Metadata = { title: "Profile" };

// S6: on-duty switch (off duty = no alerts, not offered for assignment), sign out.
export default async function StaffProfilePage() {
  const staff = await requireStaff();
  return (
    <div className="px-4 pt-5">
      <section className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5">
        <Avatar name={staff.full_name} size="lg" />
        <div>
          <p className="font-display text-lg font-extrabold">{staff.full_name}</p>
          <p className="text-sm text-muted">
            {staff.job_title ?? ROLE_LABEL[staff.role]} · {departmentName(staff.department_id)}
          </p>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-line bg-surface p-5">
        <p className="font-display font-bold">{staff.on_duty ? "You're on duty" : "You're off duty"}</p>
        <p className="mt-1 text-sm text-muted">
          {staff.on_duty ? "Managers can assign you tasks and you get alerts." : "Alerts are muted and managers won't assign you new tasks."}
        </p>
        <ActionButton action={setMyDuty.bind(null, !staff.on_duty)} variant={staff.on_duty ? "secondary" : "primary"} size="lg" className="mt-4 w-full">
          {staff.on_duty ? "Go off duty" : "Go on duty"}
        </ActionButton>
      </section>

      {staff.workpeg_subject ? (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-surface px-4 py-3 text-sm">
          <WorkpegMark onDark={false} className="size-5" /> Signed in with Workpeg
        </p>
      ) : null}

      <form action={signOut} className="mt-6">
        <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-muted hover:bg-black/5">
          <LogOut className="size-4" aria-hidden="true" /> Sign out
        </button>
      </form>
    </div>
  );
}
