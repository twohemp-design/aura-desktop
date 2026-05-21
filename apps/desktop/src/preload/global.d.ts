export {};

import type { AuraDesktopApi } from "@aura/desktop-bridge";

declare global {
  interface Window {
    auraDesktop?: AuraDesktopApi;
  }
}
