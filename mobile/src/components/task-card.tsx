import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api, type Task } from "@/lib/api";
import { tasksChanged } from "@/lib/refresh";
import { color, font } from "@/lib/theme";
import { useToast } from "./toaster";
import { Button, DueChip, PriorityBadge, priorityEdge, ServiceIcon, SourceTag, StatusChip, timeAgo } from "./ui";

/** S2 task card: the room number is the biggest thing on it. Same layout as the web. */
export function TaskCard({ t }: { t: Task }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function act(action: "start" | "complete") {
    setBusy(true);
    try {
      const res = await api.act(t.id, action);
      toast(res.message, "success");
      tasksChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "That didn't work. Try again.", "error");
      tasksChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ overflow: "hidden", borderRadius: 16, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface }}>
      <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 6, backgroundColor: priorityEdge(t.priority) }} />
      <Pressable
        onPress={() => router.push(`/task/${t.id}`)}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "flex-start", gap: 16, padding: 16, paddingLeft: 20, opacity: pressed ? 0.85 : 1 })}
        accessibilityRole="button"
        accessibilityLabel={`Room ${t.room?.number}, ${t.title}`}
      >
        <View style={{ minWidth: 72 }}>
          <Text style={{ fontSize: 11, fontFamily: font.semibold, letterSpacing: 0.6, color: color.muted }}>ROOM</Text>
          <Text style={{ fontSize: 40, lineHeight: 44, fontFamily: font.display, color: color.ink, fontVariant: ["tabular-nums"] }}>{t.room?.number}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <ServiceIcon icon={t.service?.icon} size={18} />
            <Text style={{ flex: 1, fontSize: 17, fontFamily: font.displayBold, color: color.ink }} numberOfLines={1}>
              {t.title}
            </Text>
          </View>
          <Text style={{ marginTop: 2, fontSize: 13, fontFamily: font.regular, color: color.muted }}>
            {t.guestFirstName ? `${t.guestFirstName} · ` : ""}
            {timeAgo(t.createdAt)}
          </Text>
          {t.note ? (
            <Text style={{ marginTop: 6, fontSize: 14, fontFamily: font.regular, color: color.ink }} numberOfLines={2}>
              “{t.note}”
            </Text>
          ) : null}
          <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            <DueChip due={t.due} />
            <PriorityBadge priority={t.priority} />
            {t.status !== "assigned" ? <StatusChip t={t} /> : null}
            <SourceTag t={t} />
          </View>
        </View>
      </Pressable>
      {t.status === "assigned" ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <Button size="xl" busy={busy} onPress={() => act("start")}>
            {busy ? "Starting…" : "Start task"}
          </Button>
        </View>
      ) : t.status === "in_progress" ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <Button size="xl" variant="accent" busy={busy} onPress={() => act("complete")}>
            {busy ? "Completing…" : "Mark complete"}
          </Button>
        </View>
      ) : null}
    </View>
  );
}
