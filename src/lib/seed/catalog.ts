// The demo hotel: Amber Coast Hotel (fictional), Lagos. Names and naira suit a
// Lagos judging panel; swap them for a real pilot hotel.

export const HOTEL = {
  slug: "amber-coast",
  name: "Amber Coast Hotel",
  short_name: "Amber Coast",
  accent_color: "#0F766E",
  canvas_color: "#FBF8F3",
  timezone: "Africa/Lagos",
  currency: "NGN",
  check_in_time: "14:00",
  check_out_time: "12:00",
  wifi_name: "AmberCoast-Guest",
  wifi_password: "welcome2026",
  phone: "+234 700 000 0204",
  whatsapp: "+234 700 000 0205",
  address: "12 Ozumba Mbadiwe Avenue, Victoria Island, Lagos",
  breakfast_hours: "06:30–10:30",
};

export const DEPARTMENTS = [
  { id: "housekeeping", name: "Housekeeping", sort: 1 },
  { id: "maintenance", name: "Maintenance", sort: 2 },
  { id: "food", name: "Food and drinks", sort: 3 },
  { id: "front_desk", name: "Front desk", sort: 4 },
];

type Svc = {
  id: string;
  name: string;
  category: "amenities" | "housekeeping" | "maintenance" | "food" | "front_desk";
  department_id: string;
  icon: string;
  action_verb: string;
  default_priority: "low" | "normal" | "high" | "urgent";
  response_target_min: number;
  resolution_target_min: number;
  has_quantity?: boolean;
  max_quantity?: number;
  ask_urgent?: boolean;
  needs_note?: boolean;
  guest_visible?: boolean;
  featured?: boolean;
};

const SERVICE_LIST: Svc[] = [
  { id: "extra-towels", name: "Extra towels", category: "amenities", department_id: "housekeeping", icon: "towels", action_verb: "Deliver", default_priority: "normal", response_target_min: 10, resolution_target_min: 15, has_quantity: true, max_quantity: 4, featured: true },
  { id: "toiletries", name: "Toiletries", category: "amenities", department_id: "housekeeping", icon: "toiletries", action_verb: "Deliver", default_priority: "normal", response_target_min: 10, resolution_target_min: 15, featured: true },
  { id: "extra-pillows", name: "Extra pillows", category: "amenities", department_id: "housekeeping", icon: "pillow", action_verb: "Deliver", default_priority: "normal", response_target_min: 10, resolution_target_min: 15, has_quantity: true, max_quantity: 3 },
  { id: "blanket", name: "Blanket", category: "amenities", department_id: "housekeeping", icon: "blanket", action_verb: "Deliver", default_priority: "normal", response_target_min: 10, resolution_target_min: 15, has_quantity: true, max_quantity: 2 },
  { id: "drinking-water", name: "Drinking water", category: "amenities", department_id: "housekeeping", icon: "water", action_verb: "Deliver", default_priority: "normal", response_target_min: 10, resolution_target_min: 15, has_quantity: true, max_quantity: 6 },
  { id: "room-cleaning", name: "Room cleaning", category: "housekeeping", department_id: "housekeeping", icon: "cleaning", action_verb: "Clean", default_priority: "normal", response_target_min: 10, resolution_target_min: 30, featured: true },
  { id: "turndown", name: "Turndown service", category: "housekeeping", department_id: "housekeeping", icon: "turndown", action_verb: "Turn down", default_priority: "low", response_target_min: 15, resolution_target_min: 45 },
  { id: "change-linen", name: "Change bed linen", category: "housekeeping", department_id: "housekeeping", icon: "linen", action_verb: "Change", default_priority: "normal", response_target_min: 10, resolution_target_min: 30 },
  { id: "ac-cooling", name: "AC or cooling", category: "maintenance", department_id: "maintenance", icon: "ac", action_verb: "Fix", default_priority: "high", response_target_min: 10, resolution_target_min: 60, ask_urgent: true },
  { id: "leak", name: "Leak or plumbing", category: "maintenance", department_id: "maintenance", icon: "leak", action_verb: "Fix", default_priority: "high", response_target_min: 5, resolution_target_min: 60, ask_urgent: true },
  { id: "power-lights", name: "Power or lights", category: "maintenance", department_id: "maintenance", icon: "power", action_verb: "Fix", default_priority: "high", response_target_min: 10, resolution_target_min: 60, ask_urgent: true },
  { id: "tv-wifi", name: "TV or Wi-Fi", category: "maintenance", department_id: "maintenance", icon: "tv", action_verb: "Fix", default_priority: "normal", response_target_min: 10, resolution_target_min: 60 },
  { id: "door-lock", name: "Door or lock", category: "maintenance", department_id: "maintenance", icon: "door", action_verb: "Fix", default_priority: "high", response_target_min: 5, resolution_target_min: 30, ask_urgent: true },
  { id: "food-order", name: "Food and drinks", category: "food", department_id: "food", icon: "food", action_verb: "Bring", default_priority: "normal", response_target_min: 10, resolution_target_min: 40, needs_note: true, featured: true },
  { id: "late-checkout", name: "Late checkout", category: "front_desk", department_id: "front_desk", icon: "checkout", action_verb: "Arrange", default_priority: "low", response_target_min: 10, resolution_target_min: 30 },
  { id: "luggage-help", name: "Luggage help", category: "front_desk", department_id: "front_desk", icon: "luggage", action_verb: "Help with", default_priority: "normal", response_target_min: 10, resolution_target_min: 20 },
  { id: "taxi", name: "Taxi", category: "front_desk", department_id: "front_desk", icon: "taxi", action_verb: "Book", default_priority: "normal", response_target_min: 10, resolution_target_min: 20 },
  { id: "wake-up-call", name: "Wake-up call", category: "front_desk", department_id: "front_desk", icon: "alarm", action_verb: "Schedule", default_priority: "low", response_target_min: 10, resolution_target_min: 30, needs_note: true },
  { id: "checkout-help", name: "Help with checkout", category: "front_desk", department_id: "front_desk", icon: "checkout", action_verb: "Help with", default_priority: "normal", response_target_min: 10, resolution_target_min: 20 },
  { id: "general-help", name: "Something else", category: "front_desk", department_id: "front_desk", icon: "help", action_verb: "Help with", default_priority: "normal", response_target_min: 10, resolution_target_min: 30, needs_note: true },
  { id: "safety-concern", name: "Safety concern", category: "front_desk", department_id: "front_desk", icon: "safety", action_verb: "Check on", default_priority: "urgent", response_target_min: 5, resolution_target_min: 15, guest_visible: false },
];

export const SERVICES = SERVICE_LIST.map((s, i) => ({
  has_quantity: false,
  max_quantity: 1,
  ask_urgent: false,
  needs_note: false,
  guest_visible: true,
  featured: false,
  active: true,
  sort: i + 1,
  ...s,
}));

export const STAFF = [
  { full_name: "Grace Bello", email: "grace@ambercoast.demo", role: "front_desk", job_title: "Front desk lead", department_id: "front_desk", on_duty: true },
  { full_name: "Funmi Adeyemi", email: "funmi@ambercoast.demo", role: "manager", job_title: "General manager", department_id: null, on_duty: true },
  { full_name: "Ngozi Okoro", email: "ngozi@ambercoast.demo", role: "front_desk", job_title: "Receptionist", department_id: "front_desk", on_duty: false },
  { full_name: "Amaka Obi", email: "amaka@ambercoast.demo", role: "staff", job_title: "Room attendant", department_id: "housekeeping", on_duty: true },
  { full_name: "Ibrahim Musa", email: "ibrahim@ambercoast.demo", role: "staff", job_title: "Room attendant", department_id: "housekeeping", on_duty: true },
  { full_name: "Bisi Alade", email: "bisi@ambercoast.demo", role: "staff", job_title: "Room attendant", department_id: "housekeeping", on_duty: true },
  { full_name: "Halima Yusuf", email: "halima@ambercoast.demo", role: "staff", job_title: "Room attendant", department_id: "housekeeping", on_duty: false },
  { full_name: "Tunde Bakare", email: "tunde@ambercoast.demo", role: "staff", job_title: "Technician", department_id: "maintenance", on_duty: true },
  { full_name: "Yemi Ogun", email: "yemi@ambercoast.demo", role: "staff", job_title: "Technician", department_id: "maintenance", on_duty: false },
  { full_name: "Chidi Okeke", email: "chidi@ambercoast.demo", role: "staff", job_title: "Room service", department_id: "food", on_duty: true },
  { full_name: "Kunle Ade", email: "kunle@ambercoast.demo", role: "staff", job_title: "Room service", department_id: "food", on_duty: true },
] as const;

// x01-x03 Standard Queen, x04-x09 Deluxe King (so 204 matches the brief), x10-x12 Executive Suite.
export const ROOM_TYPES = [
  { upTo: 3, type: "Standard Queen", rate: 65000 },
  { upTo: 9, type: "Deluxe King", rate: 85000 },
  { upTo: 12, type: "Executive Suite", rate: 150000 },
];

export const ROOM_OVERRIDES: Record<string, { status: "available" | "cleaning" | "maintenance"; note?: string }> = {
  "409": { status: "maintenance", note: "AC compressor being replaced" },
  "207": { status: "cleaning" },
  "311": { status: "cleaning" },
  "103": { status: "available" },
  "106": { status: "available" },
  "110": { status: "available" },
  "202": { status: "available" },
  "212": { status: "available" },
  "304": { status: "available" },
  "308": { status: "available" },
  "402": { status: "available" },
  "411": { status: "available" },
};

/** Named guests the brief and demo script refer to. */
export const NAMED_GUESTS: Record<string, { title: string; first: string; last: string; nightsBefore: number; nightsAfter: number }> = {
  "204": { title: "Mr.", first: "David", last: "Okafor", nightsBefore: 0, nightsAfter: 3 },
  "310": { title: "Ms.", first: "Sarah", last: "Lawson", nightsBefore: 1, nightsAfter: 2 },
  "112": { title: "Mrs.", first: "Kemi", last: "Adebayo", nightsBefore: 2, nightsAfter: 1 },
  "305": { title: "Mr.", first: "James", last: "Carter", nightsBefore: 1, nightsAfter: 3 },
  "208": { title: "Mrs.", first: "Fatima", last: "Sani", nightsBefore: 2, nightsAfter: 0 },
  "401": { title: "Mr.", first: "Emeka", last: "Eze", nightsBefore: 1, nightsAfter: 2 },
};

export const OTHER_GUESTS: [string, string][] = [
  ["Tolu", "Bankole"], ["Aisha", "Lawal"], ["Chinedu", "Nwosu"], ["Zainab", "Abubakar"], ["Olumide", "Coker"],
  ["Ifeoma", "Chukwu"], ["Musa", "Danjuma"], ["Yetunde", "Ojo"], ["Kwame", "Mensah"], ["Ama", "Owusu"],
  ["Daniel", "Brooks"], ["Priya", "Nair"], ["Lucas", "Silva"], ["Hannah", "Weber"], ["Femi", "Adeleke"],
  ["Ngozi", "Umeh"], ["Segun", "Afolabi"], ["Rukayat", "Salami"], ["Obinna", "Nnaji"], ["Bukola", "Adewale"],
  ["Ahmed", "Garba"], ["Chiamaka", "Obi"], ["Tobi", "Akinola"], ["Esther", "Johnson"], ["Victor", "Okon"],
  ["Mariam", "Yakubu"], ["Peter", "Udoh"], ["Grace", "Etim"], ["Samuel", "Oduya"], ["Ada", "Nwankwo"],
  ["Ibukun", "Fashola"], ["Kelechi", "Ibe"], ["Sade", "Ogunleye"], ["Moses", "Ekpo"], ["Halima", "Danladi"],
];

/** Room-service menu (prices in naira; stored in kobo). */
export const MENU = [
  { id: "jollof-chicken", name: "Jollof rice with chicken", description: "Smoky party jollof, grilled chicken, fried plantain", category: "mains", price: 8500 },
  { id: "fried-rice-beef", name: "Fried rice with beef", description: "With coleslaw and peppered beef", category: "mains", price: 8000 },
  { id: "pounded-yam-egusi", name: "Pounded yam and egusi", description: "With assorted meat", category: "mains", price: 9500 },
  { id: "club-sandwich", name: "Club sandwich and fries", description: null, category: "mains", price: 7500 },
  { id: "suya-platter", name: "Suya platter", description: "Spiced beef, onions and tomatoes", category: "light", price: 6500 },
  { id: "pepper-soup", name: "Goat meat pepper soup", description: null, category: "light", price: 6000 },
  { id: "fruit-platter", name: "Fruit platter", description: "Pineapple, watermelon, pawpaw", category: "desserts", price: 3500 },
  { id: "chocolate-cake", name: "Chocolate cake", description: null, category: "desserts", price: 3000 },
  { id: "bottled-water", name: "Bottled water", description: "75 cl", category: "drinks", price: 800 },
  { id: "chapman", name: "Chapman", description: "House mocktail", category: "drinks", price: 2500 },
  { id: "orange-juice", name: "Fresh orange juice", description: null, category: "drinks", price: 3000 },
  { id: "soft-drink", name: "Soft drink", description: "Coke, Fanta or Sprite", category: "drinks", price: 1200 },
  { id: "coffee", name: "Coffee", description: "Americano or cappuccino", category: "drinks", price: 2000 },
] as const;

/** Weighted mix for generated history (service id, weight). */
export const HISTORY_MIX: [string, number][] = [
  ["extra-towels", 20], ["room-cleaning", 17], ["toiletries", 11], ["food-order", 15], ["ac-cooling", 7],
  ["tv-wifi", 6], ["drinking-water", 5], ["late-checkout", 5], ["leak", 3], ["power-lights", 3],
  ["taxi", 4], ["luggage-help", 4], ["extra-pillows", 3], ["change-linen", 3],
];

export const DOWN_NOTES = [
  "Towels were still damp",
  "AC is still not cold",
  "Food arrived cold",
  "Took over an hour",
  "Wi-Fi still drops",
];
