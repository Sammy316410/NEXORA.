import {
  AirVent,
  AlarmClock,
  Bath,
  BedDouble,
  CarTaxiFront,
  CircleQuestionMark,
  Clock,
  ConciergeBell,
  DoorClosed,
  Droplet,
  Droplets,
  Luggage,
  Moon,
  Shirt,
  ShieldExclamationPoint,
  Sparkles,
  Tv,
  Utensils,
  Wind,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

// Service icon keys (services.icon) -> Lucide icons.
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

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  amenities: Bath,
  housekeeping: Sparkles,
  maintenance: Wrench,
  food: Utensils,
  front_desk: ConciergeBell,
};

export function ServiceIcon({ icon, className, strokeWidth = 1.75 }: { icon: string | null | undefined; className?: string; strokeWidth?: number }) {
  const Icon = (icon && SERVICE_ICONS[icon]) || CircleQuestionMark;
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}

export function CategoryIcon({ category, className, strokeWidth = 1.75 }: { category: string; className?: string; strokeWidth?: number }) {
  const Icon = CATEGORY_ICONS[category] ?? CircleQuestionMark;
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}
