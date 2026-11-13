import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogOut } from "lucide-react-native";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useTasks } from "@/lib/tasks";
import { color, DEPARTMENT, font, ROLE } from "@/lib/theme";
import { useToast } from "@/components/toaster";
import { Avatar, Button } from "@/components/ui";

// S6: on-duty switch (off duty = no alerts, not offered for assignment), sign out.
export default function ProfileScreen() {
  const { session, signOut, patchStaff } = useSession();
  const { data, reload } = useTasks();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!session) return null;
  const staff = session.staff;
  const onDuty = data?.staff.onDuty ?? staff.on_duty;

  async function toggle() {
    setBusy(true);
    try {
      const res = await api.setDuty(!onDuty);
      patchStaff({ on_duty: res.onDuty });
      toast(res.message, "success");
      await reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't change your duty status.", "error");
    } finally {
      setBusy(false);
    }
  }

  const card = { borderRadius: 16, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface, padding: 20 } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.canvas }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 }}>
        <View style={[card, { flexDirection: "row", alignItems: "center", gap: 16 }]}>
          <Avatar name={staff.full_name} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontFamily: font.display, color: color.ink }}>{staff.full_name}</Text>
            <Text style={{ fontSize: 14, fontFamily: font.regular, color: color.muted }}>
              {ROLE[staff.role] ?? staff.role} · {DEPARTMENT[staff.department_id ?? ""] ?? "All departments"}
            </Text>
          </View>
        </View>

        <View style={[card, { marginTop: 16 }]}>
          <Text style={{ fontSize: 16, fontFamily: font.displayBold, color: color.ink }}>{onDuty ? "You're on duty" : "You're off duty"}</Text>
          <Text style={{ marginTop: 4, fontSize: 14, fontFamily: font.regular, color: color.muted }}>
            {onDuty ? "Managers can assign you tasks and you get alerts." : "Alerts are muted and managers won't assign you new tasks."}
          </Text>
          <Button variant={onDuty ? "secondary" : "primary"} size="lg" busy={busy} onPress={toggle} style={{ marginTop: 16 }}>
            {onDuty ? "Go off duty" : "Go on duty"}
          </Button>
        </View>

        <Text style={{ marginTop: 16, fontSize: 13, fontFamily: font.regular, color: color.muted, textAlign: "center" }}>{session.hotel.name}</Text>

        <Pressable
          onPress={signOut}
          accessibilityRole="button"
          style={({ pressed }) => ({
            marginTop: 16,
            minHeight: 48,
            borderRadius: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: pressed ? "rgba(0,0,0,0.05)" : "transparent",
          })}
        >
          <LogOut size={16} color={color.muted} />
          <Text style={{ fontSize: 14, fontFamily: font.medium, color: color.muted }}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
