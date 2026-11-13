import { getHotel } from "@/lib/hotel";
import { workpegConfig } from "@/lib/workpeg";
import { mobile } from "@/lib/mobile-auth";

// GET: what the mobile sign-in screen needs before anyone is signed in.
export async function GET() {
  return mobile(async () => {
    const hotel = await getHotel();
    return {
      hotel: { name: hotel.name, shortName: hotel.short_name },
      demo: process.env.NEXORA_DEMO_MODE === "true",
      workpegSignIn: workpegConfig().signInEnabled,
    };
  });
}
