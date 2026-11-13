import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useSession } from "@/lib/session";
import { color } from "@/lib/theme";

export default function Index() {
  const { session, ready } = useSession();
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.canvas }}>
        <ActivityIndicator color={color.ink} />
      </View>
    );
  }
  return <Redirect href={session ? "/tasks" : "/login"} />;
}
