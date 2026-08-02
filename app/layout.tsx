import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://RouteBuddy.vercel.app"),
  title: { default: "RouteBuddy | Routes that look like something", template: "%s | RouteBuddy" },
  description: "Turn an idea into a route concept you can export and share.",
  applicationName: "RouteBuddy",
  openGraph: { title: "RouteBuddy | Routes that look like something", description: "Turn an idea into a route concept you can export and share.", type: "website" },
  twitter: { card: "summary", title: "RouteBuddy", description: "Routes that look like something." },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
