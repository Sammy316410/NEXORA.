import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, type Task } from "@/lib/api";
import { tasksChanged } from "@/lib/refresh";
import { useSession } from "@/lib/session";
import { useTasks } from "@/lib/tasks";
import { color, DEPARTMENT, font } from "@/lib/theme";
import { useToast } from "@/components/toaster";
import { LiveDot } from "@/components/live-dot";
import { Button, DueChip, ServiceIcon, timeAgo, WaitingChip } from "@/components/ui";

// S5: unassigned requests in my department that I can claim.
export default function PoolScreen() {
  const { session } = useSession();
  const { data, reload } = useTasks();
  const [refreshing, setRefreshing] = useState(false);
  if (!session) return null;
  const dept = (DEPARTMENT[session.staff.department_id ?? ""] ?? "department").toLowerCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.canvas }} edges={["top"]}>
      <LiveDot />
      <FlatList
        data={data?.pool ?? []}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await reload();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <View style={{ paddingRight: 96, marginBottom: 4 }}>
            <Text style={{ fontSize: 26, lineHeight: 32, fontFamily: font.display, color: color.ink, letterSpacing: -0.4 }}>Open pool</Text>
            <Text style={{ marginTop: 4, fontSize: 14, fontFamily: font.regular, color: color.muted }}>
              Unassigned {dept} requests. Claim one and it&apos;s yours.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={{ borderRadius: 16, backgroundColor: color.surface, paddingHorizontal: 16, paddingVertical: 48, alignItems: "center" }}>
            <Text style={{ fontSize: 18, fontFamily: font.displayBold, color: color.ink }}>{data ? "Nothing waiting. Nice." : "Loading…"}</Text>
          </View>
        }
        renderItem={({ item }) => <PoolCard t={item} />}
      />
    </SafeAreaView>
  );
}

function PoolCard({ t }: { t: Task }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function claim() {
    setBusy(true);
    try {
      const res = await api.act(t.id, "claim");
      toast(res.message, "success");
      tasksChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't claim it.", "error");
      tasksChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface, padding: 16 }}>
      <Pressable onPress={() => router.push(`/task/${t.id}`)} style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}>
        <Text style={{ minWidth: 64, fontSize: 34, lineHeight: 38, fontFamily: font.display, color: color.ink, fontVariant: ["tabular-nums"] }}>{t.room?.number}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <ServiceIcon icon={t.service?.icon} size={16} />
            <Text style={{ flex: 1, fontSize: 16, fontFamily: font.displayBold, color: color.ink }} numberOfLines={2}>
              {t.title}
            </Text>
          </View>
          <Text style={{ fontSize: 13, fontFamily: font.regular, color: color.muted }}>
            {t.guestFirstName ? `${t.guestFirstName} · ` : ""}
            {timeAgo(t.createdAt)}
          </Text>
          <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <WaitingChip label={t.waitingLabel} />
            <DueChip due={t.due} />
          </View>
        </View>
      </Pressable>
      <Button size="lg" busy={busy} onPress={claim} style={{ marginTop: 12 }}>
        {busy ? "Claiming…" : "Claim"}
      </Button>
    </View>
  );
}
