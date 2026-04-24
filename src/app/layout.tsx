import type { Metadata } from "next";
import { CallProvider } from "@/components/telephony/CallProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cold Calling CRM",
  description: "CRM privat per gestionar cold calling, leads, pipeline i trucades WebRTC."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca">
      <body>
        <CallProvider>{children}</CallProvider>
      </body>
    </html>
  );
}
