import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, MapPin } from "lucide-react-native";
import { api, ApiError, type TaskDetail } from "@/lib/api";
import { tasksChanged } from "@/lib/refresh";
import { useSession } from "@/lib/session";
import { color, DEPARTMENT, font } from "@/lib/theme";
import { useToast } from "@/components/toaster";
import { Button, clock, DueChip, PriorityBadge, ServiceIcon, StatusChip } from "@/components/ui";

const REASONS = ["Needs parts", "Guest not in the room", "Wrong department", "Need help from a colleague"];

// S3: everything needed to do the job, with one big action at the bottom. Same as the web.
export default function TaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { session, expire } = useSession();
  const [d, setD] = useState<TaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const [backOpen, setBackOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);

  const load = useCallback(async () => {
    try {
      setD(await api.task(id));
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return expire();
      setError(err instanceof Error ? err.message : "Couldn't load this task.");
    }
  }, [id, expire]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 7_000);
    return () => clearInterval(timer);
  }, [load]);

  async function act(action: "claim" | "start" | "complete" | "handback", extra: { note?: string; followUp?: boolean; reason?: string } = {}) {
    setBusy(action);
    try {
      const res = await api.act(id, action, extra);
      tasksChanged();
      toast(res.message, action === "handback" ? "info" : "success");
      if (action === "handback" || action === "complete") {
        router.back();
        return;
      }
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "That didn't work. Try again.", "error");
      await load();
    } finally {
      setBusy(null);
    }
  }

  const t = d?.task;
  const open = t && (t.status === "assigned" || t.status === "in_progress");
  const claimable = t && t.status === "pending" && !t.assignee;
  const canAct = open && session && (t.assignee?.id === session.staff.id || session.staff.role !== "staff");
  const showBar = canAct || claimable;
  const card = { borderRadius: 16, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.canvas }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: showBar ? 140 : 40 }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginBottom: 12 }}>
          <ChevronLeft size={16} color={color.muted} />
          <Text style={{ fontSize: 14, fontFamily: font.medium, color: color.muted }}>My tasks</Text>
        </Pressable>

        {error ? (
          <Text style={{ marginBottom: 12, borderRadius: 12, backgroundColor: color.alertBg, color: color.alert, padding: 12, fontSize: 14, fontFamily: font.regular }}>{error}</Text>
        ) : null}

        {!t ? (
          !error ? <Text style={{ fontSize: 14, fontFamily: font.regular, color: color.muted }}>Loading…</Text> : null
        ) : (
          <>
            <View style={[card, { padding: 20 }]}>
              <Text style={{ fontSize: 11, fontFamily: font.semibold, letterSpacing: 0.6, color: color.muted }}>ROOM</Text>
              <Text style={{ fontSize: 64, lineHeight: 70, fontFamily: font.display, color: color.ink, fontVariant: ["tabular-nums"] }}>{t.room?.number}</Text>
              <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <MapPin size={16} color={color.muted} />
                <Text style={{ fontSize: 14, fontFamily: font.regular, color: color.muted }}>
                  Floor {t.room?.floor}
                  {t.room?.landmark ? ` · ${t.room.landmark}` : ""}
                </Text>
              </View>
              <View style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ServiceIcon icon={t.service?.icon} size={20} />
                <Text style={{ flex: 1, fontSize: 20, fontFamily: font.display, color: color.ink }}>
                  {t.quantity > 1 ? `${t.quantity} × ` : ""}
                  {t.title}
                </Text>
              </View>
              <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                <StatusChip t={t} size="md" />
                <DueChip due={t.due} size="md" />
                {t.priority === "urgent" || t.priority === "high" ? <PriorityBadge priority={t.priority} /> : null}
              </View>
              {t.note ? (
                <View style={{ marginTop: 16, borderLeftWidth: 4, borderLeftColor: color.ink, borderRadius: 12, backgroundColor: color.subtle, paddingHorizontal: 16, paddingVertical: 12 }}>
                  <Text style={{ fontSize: 15, fontFamily: font.regular, color: color.ink }}>“{t.note}”</Text>
                  {t.guestFirstName ? <Text style={{ marginTop: 4, fontSize: 14, fontFamily: font.regular, color: color.muted }}>{t.guestFirstName}, guest</Text> : null}
                </View>
              ) : t.guestFirstName ? (
                <Text style={{ marginTop: 16, fontSize: 14, fontFamily: font.regular, color: color.muted }}>For {t.guestFirstName}</Text>
              ) : null}
            </View>

            {d.otherRequestsFromRoom ? (
              <Text style={{ marginTop: 12, borderRadius: 12, backgroundColor: color.progressBg, color: color.progress, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, fontFamily: font.regular }}>
                {d.otherRequestsFromRoom} other request{d.otherRequestsFromRoom === 1 ? "" : "s"} from this room in the last 24 hours.
              </Text>
            ) : null}

            <View style={[card, { marginTop: 16, padding: 16 }]}>
              <Text style={{ marginBottom: 8, fontSize: 14, fontFamily: font.semibold, color: color.muted }}>History</Text>
              <View style={{ gap: 6 }}>
                {d.events.map((e) => (
                  <View key={e.id} style={{ flexDirection: "row", gap: 12 }}>
                    <Text style={{ width: 44, fontSize: 14, fontFamily: font.regular, color: color.muted, fontVariant: ["tabular-nums"] }}>{clock(e.at, session?.hotel.timezone)}</Text>
                    <Text style={{ flex: 1, fontSize: 14, fontFamily: font.regular, color: color.ink }}>{e.message}</Text>
                  </View>
                ))}
              </View>
            </View>

            {canAct ? (
              <View style={{ marginTop: 16, gap: 8 }}>
                {t.status === "in_progress" ? (
                  noteOpen ? (
                    <View style={[card, { padding: 16, gap: 12 }]}>
                      <TextInput
                        value={note}
                        onChangeText={setNote}
                        maxLength={300}
                        multiline
                        placeholder="e.g. Replaced the tap washer"
                        placeholderTextColor={color.muted}
                        style={{ minHeight: 80, borderRadius: 12, borderWidth: 1, borderColor: color.lineStrong, padding: 12, fontSize: 15, fontFamily: font.regular, color: color.ink, textAlignVertical: "top" }}
                      />
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <Switch value={followUp} onValueChange={setFollowUp} trackColor={{ true: color.accent }} />
                        <Text style={{ flex: 1, fontSize: 14, fontFamily: font.medium, color: color.ink }}>Needs follow-up (e.g. a part is on order)</Text>
                      </View>
                      <Button variant="accent" size="lg" busy={busy === "complete"} onPress={() => act("complete", { note, followUp })}>
                        Complete with note
                      </Button>
                    </View>
                  ) : (
                    <Pressable onPress={() => setNoteOpen(true)} style={{ paddingVertical: 8 }}>
                      <Text style={{ textAlign: "center", fontSize: 14, fontFamily: font.medium, color: color.muted }}>Add a note or flag a follow-up</Text>
                    </Pressable>
                  )
                ) : null}

                {backOpen ? (
                  <View style={[card, { borderColor: "rgba(184,0,28,0.25)", padding: 16, gap: 12 }]}>
                    <Text style={{ fontSize: 16, fontFamily: font.displayBold, color: color.ink }}>Why can&apos;t you do it?</Text>
                    <View style={{ gap: 8 }}>
                      {REASONS.map((r) => (
                        <Pressable
                          key={r}
                          onPress={() => setReason(r)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: reason === r }}
                          style={{
                            minHeight: 48,
                            justifyContent: "center",
                            borderRadius: 12,
                            borderWidth: 1,
                            paddingHorizontal: 12,
                            borderColor: reason === r ? color.ink : color.lineStrong,
                            backgroundColor: reason === r ? color.ink : color.surface,
                          }}
                        >
                          <Text style={{ fontSize: 14, fontFamily: font.medium, color: reason === r ? "#fff" : color.ink }}>{r}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Button variant="danger" size="lg" busy={busy === "handback"} onPress={() => act("handback", { reason })} style={{ flex: 1 }}>
                        Hand it back
                      </Button>
                      <Button variant="ghost" size="lg" onPress={() => setBackOpen(false)}>
                        Cancel
                      </Button>
                    </View>
                  </View>
                ) : (
                  <Pressable onPress={() => setBackOpen(true)} style={{ paddingVertical: 8 }}>
                    <Text style={{ textAlign: "center", fontSize: 14, fontFamily: font.medium, color: color.alert }}>Can&apos;t do it?</Text>
                  </Pressable>
                )}
              </View>
            ) : !claimable ? (
              <Text style={{ marginTop: 24, textAlign: "center", fontSize: 14, fontFamily: font.regular, color: color.muted }}>
                This task is {t.status === "completed" ? "done" : t.statusLabel.toLowerCase()}. Nice work.
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>

      {t && showBar ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            borderTopWidth: 1,
            borderTopColor: color.line,
            backgroundColor: "rgba(245,245,245,0.97)",
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: insets.bottom + 12,
          }}
        >
          {claimable ? (
            <Button size="xl" busy={busy === "claim"} onPress={() => act("claim")}>
              {busy === "claim" ? "Claiming…" : "Claim"}
            </Button>
          ) : t.status === "assigned" ? (
            <Button size="xl" busy={busy === "start"} onPress={() => act("start")}>
              {busy === "start" ? "Starting…" : "Start task"}
            </Button>
          ) : (
            <Button size="xl" variant="accent" busy={busy === "complete"} onPress={() => act("complete")}>
              {busy === "complete" ? "Completing…" : "Mark complete"}
            </Button>
          )}
          <Text style={{ marginTop: 6, textAlign: "center", fontSize: 12, fontFamily: font.regular, color: color.muted }}>
            {DEPARTMENT[t.departmentId] ?? t.departmentId} · {t.code}
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
