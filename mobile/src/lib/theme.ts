// Same tokens as the web app (src/app/globals.css), so phone and web are one product.
export const color = {
  ink: "#0d0d0d",
  inkSoft: "#1c1c1c",
  muted: "#6b6b70",
  canvas: "#f5f5f5",
  surface: "#ffffff",
  subtle: "#fafafa",
  line: "#ebebec",
  lineStrong: "#dedede",
  accent: "#0064ff",
  accentSubtle: "#eef4ff",
  pending: "#5b3fd6",
  pendingBg: "#f1eeff",
  assigned: "#0050cc",
  assignedBg: "#e3edff",
  progress: "#8a5300",
  progressBg: "#fff4d6",
  done: "#006b2e",
  doneBg: "#e3f5ea",
  alert: "#b8001c",
  alertBg: "#fde8ea",
  alertSolid: "#ed0025",
  high: "#F5A524",
  neutral: "#4d4d52",
  neutralBg: "#f0f0f1",
  live: "#1FA35B",
} as const;

// Plus Jakarta Sans for headings ("display"), Geist for everything else, as on the web.
export const font = {
  regular: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
  bold: "Geist_700Bold",
  displaySemibold: "PlusJakartaSans_600SemiBold",
  displayBold: "PlusJakartaSans_700Bold",
  display: "PlusJakartaSans_800ExtraBold",
} as const;

export const cardShadow = {
  shadowColor: "#0d0d0d",
  shadowOpacity: 0.04,
  shadowRadius: 2,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
} as const;

export const floatShadow = {
  shadowColor: "#0d0d0d",
  shadowOpacity: 0.12,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 12 },
  elevation: 8,
} as const;

export type Tone = "pending" | "assigned" | "progress" | "done" | "alert" | "neutral";

export const tone: Record<Tone, { fg: string; bg: string }> = {
  pending: { fg: color.pending, bg: color.pendingBg },
  assigned: { fg: color.assigned, bg: color.assignedBg },
  progress: { fg: color.progress, bg: color.progressBg },
  done: { fg: color.done, bg: color.doneBg },
  alert: { fg: color.alert, bg: color.alertBg },
  neutral: { fg: color.neutral, bg: color.neutralBg },
};

export const STATUS_TONE: Record<string, Tone> = {
  awaiting_payment: "neutral",
  pending: "pending",
  assigned: "assigned",
  in_progress: "progress",
  completed: "done",
  cancelled: "neutral",
};

export const DEPARTMENT: Record<string, string> = {
  housekeeping: "Housekeeping",
  maintenance: "Maintenance",
  food: "Food & beverage",
  front_desk: "Front desk",
};

export const ROLE: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  front_desk: "Front desk",
  staff: "Staff",
};
