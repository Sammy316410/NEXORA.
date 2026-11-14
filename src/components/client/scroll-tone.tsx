"use client";

import { useEffect } from "react";

/**
 * Lets the page scrollbar blend in: while a section marked
 * data-scroll-tone="dark" sits behind the middle of the screen, <html> gets
 * data-scroll-tone="dark" and globals.css paints the scrollbar dark.
 */
export function ScrollTone() {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;

    const update = () => {
      frame = 0;
      const middle = window.innerHeight / 2;
      const dark = Array.from(
        document.querySelectorAll<HTMLElement>('[data-scroll-tone="dark"]'),
      ).some((el) => {
        const box = el.getBoundingClientRect();
        return box.top <= middle && box.bottom >= middle;
      });
      if (dark) root.dataset.scrollTone = "dark";
      else delete root.dataset.scrollTone;
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
      delete root.dataset.scrollTone;
    };
  }, []);

  return null;
}
