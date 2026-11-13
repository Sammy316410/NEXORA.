import { Text, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { color, font } from "@/lib/theme";

/** NEXORA mark: an N drawn through three joined nodes (guest, staff, manager). Same as the web. */
export function NexoraMark({ size = 32, inverted = false }: { size?: number; inverted?: boolean }) {
  const fg = inverted ? "#0D0D0D" : "#FFFFFF";
  const bg = inverted ? "#FFFFFF" : "#0D0D0D";
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityLabel="NEXORA">
      <Rect width="32" height="32" rx="9" fill={bg} />
      <Path d="M9 23V9l14 14V9" fill="none" stroke={fg} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="9" cy="9" r="3" fill="#0064FF" stroke={bg} strokeWidth="1.2" />
      <Circle cx="23" cy="23" r="3" fill={fg} stroke={bg} strokeWidth="1.2" />
      <Circle cx="23" cy="9" r="3" fill={fg} stroke={bg} strokeWidth="1.2" />
    </Svg>
  );
}

export function NexoraLogo() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <NexoraMark />
      <Text style={{ fontFamily: font.display, fontSize: 18, letterSpacing: 1.4, color: color.ink }}>NEXORA</Text>
    </View>
  );
}

/** Workpeg's mark. onDark: white tile, black glyph. */
export function WorkpegMark({ size = 20, onDark = true }: { size?: number; onDark?: boolean }) {
  const tile = onDark ? "white" : "black";
  const glyph = onDark ? "black" : "white";
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" accessibilityLabel="Workpeg">
      <Rect width="19.9657" height="20" rx="5.55556" fill={tile} />
      <Path
        d="M3.52008 11.7631V7.07485C3.52008 6.88706 3.67231 6.73483 3.8601 6.73483H6.73597C6.92376 6.73483 7.07599 6.88706 7.07599 7.07485V11.694C7.07599 11.7114 7.09897 11.7176 7.10769 11.7025L8.58545 9.15773C9.24763 8.01741 10.8996 8.03235 11.541 9.18447L13.0138 11.8297C13.0223 11.845 13.0456 11.839 13.0456 11.8214V7.07483C13.0456 6.88704 13.1978 6.73481 13.3856 6.73481H16.1057C16.2935 6.73481 16.4457 6.88704 16.4457 7.07483V11.8061C16.4457 12.3403 16.2361 12.8533 15.862 13.2347L13.6691 15.4702C13.1284 16.0213 12.2379 16.0124 11.7084 15.4505L10.0868 13.7297L8.50222 15.4594C7.98851 16.0201 7.11482 16.0507 6.56316 15.5272L4.15591 13.243C3.74997 12.8578 3.52008 12.3227 3.52008 11.7631Z"
        fill={glyph}
        stroke={tile}
        strokeWidth="0.740742"
      />
      <Circle cx="9.98314" cy="5.48232" r="1.9622" fill={glyph} />
    </Svg>
  );
}
