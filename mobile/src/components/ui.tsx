import { ActivityIndicator, Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import {
  AirVent,
  AlarmClock,
  Bath,
  BedDouble,
  CarTaxiFront,
  CircleCheck,
  CircleQuestionMark,
  CircleX,
  Clock,
  DoorClosed,
  Droplet,
  Droplets,
  Hourglass,
  Inbox,
  Luggage,
  Moon,
  Phone,
  Shirt,
  ShieldExclamationPoint,
  Sparkles,
  Timer,
  TriangleExclamationPoint,
  Tv,
  UserCheck,
  Utensils,
  Wallet,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react-native";
import { color, font, tone as tones, STATUS_TONE, type Tone } from "@/lib/theme";
import type { Task } from "@/lib/api";

// ---------------------------------------------------------------------------
// Buttons: same variants and sizes as src/components/ui.tsx on the web.

const VARIANT = {
  primary: { bg: color.ink, fg: "#fff", border: undefined },
  accent: { bg: color.accent, fg: "#fff", border: undefined },
  secondary: { bg: color.surface, fg: color.ink, border: color.lineStrong },
  ghost: { bg: "transparent", fg: color.ink, border: undefined },
  danger: { bg: color.surface, fg: color.alert, border: "rgba(184,0,28,0.25)" },
} as const;

const SIZE = {
  md: { height: 40, radius: 8, px: 16, text: 14 },
  lg: { height: 48, radius: 12, px: 20, text: 15 },
  xl: { height: 56, radius: 16, px: 24, text: 16 },
} as const;

export function Button({
  children,
  onPress,
  variant = "primary",
  size = "lg",
  busy = false,
  disabled = false,
  icon,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: keyof typeof VARIANT;
  size?: keyof typeof SIZE;
  busy?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const v = VARIANT[variant];
  const z = SIZE[size];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        {
          height: z.height,
          borderRadius: z.radius,
          paddingHorizontal: z.px,
          backgroundColor: pressed && variant !== "ghost" ? (variant === "primary" ? color.inkSoft : variant === "accent" ? "#005be8" : color.subtle) : v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={v.fg} /> : icon}
      <Text style={{ color: v.fg, fontSize: z.text, fontFamily: font.medium }}>{children}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: color.surface, borderRadius: 16, borderWidth: 1, borderColor: color.line }, style]}>{children}</View>;
}

export function T({ children, style, numberOfLines }: { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return (
    <Text style={[{ fontFamily: font.regular, color: color.ink, fontSize: 15 }, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Chips: same tones, icons and labels as src/components/status.tsx.

export function Chip({ tone = "neutral", icon: Icon, children, size = "sm" }: { tone?: Tone; icon?: LucideIcon; children: React.ReactNode; size?: "sm" | "md" }) {
  const t = tones[tone];
  const md = size === "md";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        alignSelf: "flex-start",
        borderRadius: 999,
        backgroundColor: t.bg,
        paddingHorizontal: md ? 10 : 8,
        paddingVertical: md ? 4 : 2,
      }}
    >
      {Icon ? <Icon size={md ? 14 : 12} color={t.fg} strokeWidth={2.25} /> : null}
      <Text style={{ color: t.fg, fontSize: md ? 13 : 12, fontFamily: font.medium, fontVariant: ["tabular-nums"] }}>{children}</Text>
    </View>
  );
}

const STATUS_ICON: Record<string, LucideIcon> = {
  awaiting_payment: Wallet,
  pending: Inbox,
  assigned: UserCheck,
  in_progress: Timer,
  completed: CircleCheck,
  cancelled: CircleX,
};

export function StatusChip({ t, size }: { t: Pick<Task, "status" | "statusLabel">; size?: "sm" | "md" }) {
  return (
    <Chip tone={STATUS_TONE[t.status]} icon={STATUS_ICON[t.status]} size={size}>
      {t.statusLabel}
    </Chip>
  );
}

/** Neutral, amber under 5 min, red when overdue. */
export function DueChip({ due, size }: { due: Task["due"]; size?: "sm" | "md" }) {
  if (due.kind === "none" || !due.label) return null;
  const tn: Tone = due.kind === "overdue" ? "alert" : due.kind === "soon" ? "progress" : "neutral";
  return (
    <Chip tone={tn} icon={due.kind === "overdue" ? TriangleExclamationPoint : Clock} size={size}>
      {due.label}
    </Chip>
  );
}

export function WaitingChip({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <Chip tone="progress" icon={Hourglass}>
      {label}
    </Chip>
  );
}

export function PriorityBadge({ priority }: { priority: Task["priority"] }) {
  if (priority === "urgent")
    return (
      <Chip tone="alert" icon={TriangleExclamationPoint}>
        Urgent
      </Chip>
    );
  if (priority === "high")
    return (
      <Chip tone="progress" icon={TriangleExclamationPoint}>
        High
      </Chip>
    );
  return null;
}

export function SourceTag({ t }: { t: Pick<Task, "source" | "sourceLabel"> }) {
  if (t.source === "guest_portal") return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {t.source === "phone" ? <Phone size={12} color={color.muted} /> : null}
      <Text style={{ fontSize: 12, color: color.muted, fontFamily: font.regular }}>{t.sourceLabel}</Text>
    </View>
  );
}

/** Left-edge colour bar for request cards. */
export function priorityEdge(priority: Task["priority"]): string {
  return priority === "urgent" ? color.alertSolid : priority === "high" ? color.high : "transparent";
}

// ---------------------------------------------------------------------------
// Service icons: same mapping as src/components/icons.tsx.

const SERVICE_ICONS: Record<string, LucideIcon> = {
  towels: Bath,
  toiletries: Droplets,
  pillow: BedDouble,
  blanket: Wind,
  water: Droplet,
  cleaning: Sparkles,
  turndown: Moon,
  linen: Shirt,
  ac: AirVent,
  leak: Droplet,
  power: Zap,
  tv: Tv,
  door: DoorClosed,
  food: Utensils,
  checkout: Clock,
  luggage: Luggage,
  taxi: CarTaxiFront,
  alarm: AlarmClock,
  help: CircleQuestionMark,
  safety: ShieldExclamationPoint,
};

export function ServiceIcon({ icon, size = 18, color: c = color.muted }: { icon: string | null | undefined; size?: number; color?: string }) {
  const Icon = (icon && SERVICE_ICONS[icon]) || CircleQuestionMark;
  return <Icon size={size} color={c} strokeWidth={1.75} />;
}

// ---------------------------------------------------------------------------

export function Avatar({ name, size = 56 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color.ink, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontFamily: font.displayBold, fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h ago`;
  return `${Math.floor(minutes / 1440)} d ago`;
}

export function clock(iso: string | null, tz = "Africa/Lagos"): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(iso));
}
