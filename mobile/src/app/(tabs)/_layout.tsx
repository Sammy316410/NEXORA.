import { Pressable, Text, View } from "react-native";
import { Redirect, Tabs, usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleUser, Inbox, ListTodo, type LucideIcon } from "lucide-react-native";
import { useSession } from "@/lib/session";
import { TasksProvider, useTasks } from "@/lib/tasks";
import { color, font } from "@/lib/theme";

// Staff app shell: a one-handed task list with the web app's bottom tab bar.
export default function StaffLayout() {
  const { session } = useSession();
  if (!session) return <Redirect href="/login" />;
  return (
    <TasksProvider>
      <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.canvas } }} tabBar={() => <StaffTabBar />}>
        <Tabs.Screen name="tasks" />
        <Tabs.Screen name="pool" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </TasksProvider>
  );
}

function StaffTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data } = useTasks();
  const tabs: { href: "/tasks" | "/pool" | "/profile"; label: string; icon: LucideIcon; badge?: number }[] = [
    { href: "/tasks", label: "Tasks", icon: ListTodo },
    { href: "/pool", label: "Open pool", icon: Inbox, badge: data?.pool.length },
    { href: "/profile", label: "Profile", icon: CircleUser },
  ];
  return (
    <View style={{ flexDirection: "row", backgroundColor: color.surface, borderTopWidth: 1, borderTopColor: color.line, paddingBottom: insets.bottom }}>
      {tabs.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Pressable
            key={t.href}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t.badge ? `${t.label}, ${t.badge} waiting` : t.label}
            onPress={() => router.navigate(t.href)}
            style={{ flex: 1, minHeight: 64, alignItems: "center", justifyContent: "center", gap: 4 }}
          >
            <View>
              <Icon size={24} color={active ? color.ink : color.muted} strokeWidth={active ? 2.2 : 1.75} />
              {t.badge ? (
                <View style={{ position: "absolute", top: -6, right: -10, minWidth: 16, borderRadius: 8, backgroundColor: color.accent, paddingHorizontal: 4 }}>
                  <Text style={{ color: "#fff", fontSize: 10, lineHeight: 16, fontFamily: font.bold, textAlign: "center" }}>{t.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ fontSize: 12, fontFamily: font.medium, color: active ? color.ink : color.muted }}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
