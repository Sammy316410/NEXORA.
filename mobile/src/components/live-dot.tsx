import { Text, View } from "react-native";
import { useTasks } from "@/lib/tasks";
import { cardShadow, color, font } from "@/lib/theme";

/** "Live" pill, top right, like the web staff app. */
export function LiveDot() {
  const { live } = useTasks();
  return (
    <View
      style={[
        {
          position: "absolute",
          top: 20,
          right: 16,
          zIndex: 20,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.9)",
          paddingHorizontal: 10,
          paddingVertical: 4,
        },
        cardShadow,
      ]}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: live ? color.live : color.lineStrong }} />
      <Text style={{ fontSize: 12, fontFamily: font.medium, color: color.muted }}>{live ? "Live" : "Auto-refresh"}</Text>
    </View>
  );
}
