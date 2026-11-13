import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/lib/session";
import { useTasks } from "@/lib/tasks";
import { cardShadow, color, DEPARTMENT, font } from "@/lib/theme";
import { TaskCard } from "@/components/task-card";
import { LiveDot } from "@/components/live-dot";

type Tab = "todo" | "doing" | "done";

// S2: To do / In progress / Done today, most urgent first.
export default function TasksScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { data, error, reload } = useTasks();
  const [tab, setTab] = useState<Tab | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  if (!session) return null;

  // With no tab chosen, show the job in hand first, so "Mark complete" is right there after "Start".
  const current: Tab = tab ?? (data?.doing.length ? "doing" : "todo");
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "todo", label: "To do", count: data?.todo.length ?? 0 },
    { key: "doing", label: "In progress", count: data?.doing.length ?? 0 },
    { key: "done", label: "Done today", count: data?.done.length ?? 0 },
  ];
  const list = data ? data[current] : [];
  const onDuty = data?.staff.onDuty ?? session.staff.on_duty;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.canvas }} edges={["top"]}>
      <LiveDot />
      <FlatList
        data={list}
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
          <View style={{ marginBottom: 4 }}>
            <View style={{ paddingRight: 96, marginBottom: 16 }}>
              <Text style={{ fontSize: 26, lineHeight: 32, fontFamily: font.display, color: color.ink, letterSpacing: -0.4 }}>
                Hi {session.staff.full_name.split(" ")[0]}
              </Text>
              <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 14, fontFamily: font.regular, color: color.muted }}>{DEPARTMENT[session.staff.department_id ?? ""] ?? "All departments"}</Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    borderRadius: 999,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    backgroundColor: onDuty ? color.doneBg : color.neutralBg,
                  }}
                >
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: onDuty ? color.done : color.neutral }} />
                  <Text style={{ fontSize: 12, fontFamily: font.semibold, color: onDuty ? color.done : color.neutral }}>{onDuty ? "On duty" : "Off duty"}</Text>
                </View>
              </View>
            </View>

            <View accessibilityRole="tablist" style={{ flexDirection: "row", borderRadius: 12, backgroundColor: "rgba(235,235,236,0.6)", padding: 4, marginBottom: 12 }}>
              {tabs.map((t) => {
                const on = current === t.key;
                return (
                  <Pressable
                    key={t.key}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    onPress={() => setTab(t.key)}
                    style={[{ flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: "center" }, on && [{ backgroundColor: color.surface }, cardShadow]]}
                  >
                    <Text style={{ fontSize: 13, fontFamily: font.semibold, color: on ? color.ink : color.muted, fontVariant: ["tabular-nums"] }}>
                      {t.label} ({t.count})
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {error ? (
              <Text style={{ marginBottom: 12, borderRadius: 12, backgroundColor: color.alertBg, color: color.alert, padding: 12, fontSize: 14, fontFamily: font.regular }}>{error}</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={{ borderRadius: 16, backgroundColor: color.surface, paddingHorizontal: 16, paddingVertical: 48, alignItems: "center" }}>
            <Text style={{ fontSize: 18, fontFamily: font.displayBold, color: color.ink }}>
              {!data ? "Loading…" : current === "done" ? "Nothing finished yet today." : "You're all caught up."}
            </Text>
            {data && current === "todo" && session.staff.department_id ? (
              <Pressable onPress={() => router.navigate("/pool")} hitSlop={8}>
                <Text style={{ marginTop: 8, fontSize: 14, fontFamily: font.medium, color: color.accent }}>Check the open pool</Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <TaskCard t={item} />}
      />
    </SafeAreaView>
  );
}
