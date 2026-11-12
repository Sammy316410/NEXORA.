import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireGuest } from "@/lib/guest-session";
import { db } from "@/lib/db";
import { paymentsConfig } from "@/lib/payments/config";
import { placeOrder } from "@/app/actions/guest";
import { OrderBuilder } from "@/components/guest/order-builder";
import type { MenuItem } from "@/lib/types";

export const metadata: Metadata = { title: "Food and drinks" };

// Room service: a priced menu, a basket, then pay now or charge to the room.
export default async function OrderPage() {
  const { hotel, room } = await requireGuest();
  const { data } = await db().from("menu_items").select("*").eq("hotel_id", hotel.id).eq("available", true).order("sort");
  const menu = (data as MenuItem[]) ?? [];
  const payments = paymentsConfig();

  return (
    <div>
      <Link href="/guest" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted">
        <ChevronLeft className="size-4" aria-hidden="true" /> Back
      </Link>
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Food and drinks</h1>
      <p className="mt-1 text-sm text-muted">Delivered to Room {room.number}, usually within 40 minutes.</p>
      <Link href="/guest/request/food-order" className="mt-1 mb-5 inline-block text-sm font-medium text-hotel">
        Something not on the menu? Ask the kitchen
      </Link>
      <OrderBuilder
        action={placeOrder}
        roomNumber={room.number}
        currency={payments.currency}
        testMode={payments.mode === "test"}
        items={menu.map((m) => ({ id: m.id, name: m.name, description: m.description, category: m.category, priceMinor: m.price_minor }))}
      />
    </div>
  );
}
