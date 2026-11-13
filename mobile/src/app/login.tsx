import { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getConfig, getServer, setServer, type ServerConfig } from "@/lib/api";
import { useSession } from "@/lib/session";
import { color, font } from "@/lib/theme";
import { NexoraLogo, WorkpegMark } from "@/components/brand";
import { Button } from "@/components/ui";

// The staff-app demo profiles from the web sign-in page (src/app/login/page.tsx).
const DEMO_PROFILES = [
  { as: "amaka", name: "Amaka", role: "Housekeeping · staff app" },
  { as: "tunde", name: "Tunde", role: "Maintenance · staff app" },
];

// S1: one sign-in page, same as the web.
export default function Login() {
  const { session, signIn, signInDemo } = useSession();
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [server, setServerText] = useState("");
  const [editServer, setEditServer] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    setServerText(await getServer());
    try {
      setConfig(await getConfig());
      setError(null);
    } catch (err) {
      setConfig(null);
      setError(err instanceof Error ? err.message : "Can't reach NEXORA.");
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  if (session) return <Redirect href="/tasks" />;

  async function run(key: string, fn: () => Promise<void>) {
    setError(null);
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in.");
    } finally {
      setBusy(null);
    }
  }

  async function saveServer() {
    await setServer(server);
    setEditServer(false);
    await loadConfig();
  }

  const input = {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: color.lineStrong,
    backgroundColor: color.surface,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: font.regular,
    color: color.ink,
  } as const;
  const label = { fontSize: 14, fontFamily: font.medium, color: color.ink, marginBottom: 6 } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.canvas }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 40, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <View style={{ marginBottom: 32 }}>
            <NexoraLogo />
          </View>

          <Text style={{ fontSize: 24, lineHeight: 30, fontFamily: font.display, color: color.ink, letterSpacing: -0.3 }}>
            Sign in to {config?.hotel.name ?? "your hotel"}
          </Text>
          <Text style={{ marginTop: 4, fontSize: 14, fontFamily: font.regular, color: color.muted }}>Use your hotel&apos;s Workpeg account.</Text>

          {error ? (
            <Text accessibilityRole="alert" style={{ marginTop: 20, borderRadius: 12, backgroundColor: color.alertBg, color: color.alert, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: font.regular }}>
              {error}
            </Text>
          ) : null}

          <View
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            style={{ marginTop: 24, height: 48, borderRadius: 999, backgroundColor: "#000", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, opacity: 0.6 }}
          >
            <WorkpegMark />
            <Text style={{ color: "#fff", fontSize: 15, fontFamily: font.medium }}>Sign in with Workpeg</Text>
          </View>
          <Text style={{ marginTop: 8, textAlign: "center", fontSize: 12, fontFamily: font.regular, color: color.muted }}>
            Switches on once the Workpeg client ID is added.
          </Text>

          <View style={{ marginVertical: 24, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: color.line }} />
            <Text style={{ fontSize: 12, fontFamily: font.regular, color: color.muted }}>or</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: color.line }} />
          </View>

          <View style={{ gap: 16 }}>
            <View>
              <Text style={label}>Work email</Text>
              <TextInput
                style={input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@hotel.com"
                placeholderTextColor={color.muted}
              />
            </View>
            <View>
              <Text style={label}>Password</Text>
              <TextInput
                style={input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                onSubmitEditing={() => run("email", () => signIn(email, password))}
              />
            </View>
            <Button variant="secondary" size="lg" busy={busy === "email"} disabled={!email || !password} onPress={() => run("email", () => signIn(email, password))}>
              {busy === "email" ? "Signing in…" : "Sign in with email"}
            </Button>
          </View>

          {config?.demo ? (
            <View style={{ marginTop: 32, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: color.lineStrong, padding: 16 }}>
              <Text style={{ fontSize: 12, fontFamily: font.semibold, letterSpacing: 0.6, color: color.muted }}>DEMO: OPEN AS</Text>
              <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
                {DEMO_PROFILES.map((p) => (
                  <Pressable
                    key={p.as}
                    accessibilityRole="button"
                    onPress={() => run(p.as, () => signInDemo(p.as))}
                    disabled={!!busy}
                    style={({ pressed }) => ({
                      flex: 1,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: color.lineStrong,
                      backgroundColor: pressed ? color.subtle : color.surface,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      opacity: busy && busy !== p.as ? 0.5 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 14, fontFamily: font.semibold, color: color.ink }}>{busy === p.as ? "Opening…" : p.name}</Text>
                    <Text style={{ fontSize: 11, fontFamily: font.regular, color: color.muted }}>{p.role}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={{ marginTop: 32 }}>
            {editServer ? (
              <View style={{ gap: 8 }}>
                <Text style={label}>Server address</Text>
                <TextInput
                  style={input}
                  value={server}
                  onChangeText={setServerText}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  placeholder="https://your-app.vercel.app"
                  placeholderTextColor={color.muted}
                  onSubmitEditing={saveServer}
                />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Button variant="primary" size="md" onPress={saveServer} style={{ flex: 1 }}>
                    Save
                  </Button>
                  <Button variant="ghost" size="md" onPress={() => setEditServer(false)}>
                    Cancel
                  </Button>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setEditServer(true)} hitSlop={8}>
                <Text style={{ fontSize: 12, fontFamily: font.regular, color: color.muted, textAlign: "center" }}>
                  Connected to {server.replace(/^https?:\/\//, "")} · <Text style={{ color: color.accent, fontFamily: font.medium }}>Change</Text>
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
