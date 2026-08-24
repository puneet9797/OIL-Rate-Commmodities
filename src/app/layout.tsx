import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RSVPAI Live Rates — Real-Time Commodity Dashboard",
  description:
    "Monitor live oil and commodity rates in real-time with red/green change indicators, auto-refresh, one-click Excel export, and print support.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>" />
      </head>
      <body>{children}</body>
    </html>
  );
}
