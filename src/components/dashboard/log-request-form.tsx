"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { FormError, Input, Label, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/client/submit-button";
import { cn } from "@/lib/cn";

interface Opt {
  id: string;
  name: string;
  category: string;
  hasQuantity: boolean;
  maxQuantity: number;
}

export function LogRequestForm({
  action,
  services,
  staff,
  occupied,
}: {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  services: Opt[];
  staff: { id: string; name: string; department: string }[];
  occupied: { number: string; guest: string }[];
}) {
  const [state, formAction] = useActionState(action, null);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [room, setRoom] = useState("");
  const [source, setSource] = useState<"phone" | "front_desk">("phone");
  const service = services.find((s) => s.id === serviceId);
  const guest = occupied.find((o) => o.number === room.trim());
  const groups = [...new Set(services.map((s) => s.category))];

  return (
    <form action={formAction} className="grid max-w-2xl gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="room">Room</Label>
          <Input id="room" name="room" required list="rooms" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Westminster" />
          <datalist id="rooms">
            {occupied.map((o) => (
              <option key={o.number} value={o.number}>
                {o.guest}
              </option>
            ))}
          </datalist>
          <p className="mt-1.5 text-xs text-muted">{room ? (guest ? `In-house: ${guest.guest}` : "No guest checked in to this room") : "Type a room number"}</p>
        </div>
        <div>
          <Label>How did it come in?</Label>
          <input type="hidden" name="source" value={source} />
          <div className="grid h-12 grid-cols-2 rounded-xl border border-line-strong p-1 text-sm font-medium">
            {(["phone", "front_desk"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setSource(s)} className={cn("rounded-lg", source === s ? "bg-ink text-white" : "text-muted")}>
                {s === "phone" ? "Phone call" : "Walk-in"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-[1fr_120px]">
        <div>
          <Label htmlFor="serviceId">Service</Label>
          <Select id="serviceId" name="serviceId" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            {groups.map((g) => (
              <optgroup key={g} label={g.replace("_", " ")}>
                {services
                  .filter((s) => s.category === g)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="quantity">Quantity</Label>
          <Input id="quantity" name="quantity" type="number" min={1} max={service?.maxQuantity ?? 1} defaultValue={1} disabled={!service?.hasQuantity} />
        </div>
      </div>

      <div>
        <Label htmlFor="note">Note</Label>
        <Textarea id="note" name="note" maxLength={500} placeholder="What the guest said, e.g. Water dripping under the sink" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select id="priority" name="priority" defaultValue="">
            <option value="">Service default</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="assignTo">Assign now (optional)</Label>
          <Select id="assignTo" name="assignTo" defaultValue="">
            <option value="">Leave in Pending</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.department}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {state && !state.ok ? <FormError>{state.error}</FormError> : null}
      <div>
        <SubmitButton size="lg" pendingText="Logging…">
          Log request
        </SubmitButton>
        <p className="mt-2 text-xs text-muted">The guest sees it in their portal as “Logged by front desk”, so phone requests are tracked too.</p>
      </div>
    </form>
  );
}
