import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleCheck, Info, TriangleExclamationPoint } from "lucide-react-native";
import { color, floatShadow, font } from "@/lib/theme";

type Kind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  kind: Kind;
}

const Ctx = createContext<(message: string, kind?: Kind) => void>(() => {});

/** Toasts like the web app's: dark pill, icon, sits above the tab bar. */
export function Toaster({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const insets = useSafeAreaInsets();

  const toast = useCallback((message: string, kind: Kind = "info") => {
    const id = next.current++;
    setItems((list) => [...list.slice(-2), { id, message, kind }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <Ctx.Provider value={toast}>
      {children}
      <View pointerEvents="none" style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 84, gap: 8 }}>
        {items.map((t) => {
          const Icon = t.kind === "success" ? CircleCheck : t.kind === "error" ? TriangleExclamationPoint : Info;
          const iconColor = t.kind === "success" ? "#4ade80" : t.kind === "error" ? "#ff6b7d" : "#9cc2ff";
          return (
            <View
              key={t.id}
              accessibilityLiveRegion="polite"
              style={[{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: color.ink, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14 }, floatShadow]}
            >
              <Icon size={18} color={iconColor} />
              <Text style={{ flex: 1, color: "#fff", fontSize: 14, fontFamily: font.medium }}>{t.message}</Text>
            </View>
          );
        })}
      </View>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
