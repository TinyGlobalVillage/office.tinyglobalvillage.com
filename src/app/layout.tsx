import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SessionWrapper from "./components/SessionWrapper";
import ThemeProvider from "./components/ThemeProvider";
import StyledRegistry from "./StyledRegistry";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://office.tinyglobalvillage.com"),
  title: "TGV Office",
  description: "Internal operations hub — Tiny Global Village LLC",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "TGV Office",
    description: "Internal operations hub — Tiny Global Village LLC",
    siteName: "TGV Office",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "TGV Office — Tiny Global Village LLC",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TGV Office",
    description: "Internal operations hub — Tiny Global Village LLC",
    images: ["/og.png"],
  },
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
      <body className="min-h-full flex flex-col bg-[#0a0a0a] text-[#ededed]">
        <StyledRegistry><SessionWrapper><ThemeProvider>{children}</ThemeProvider></SessionWrapper></StyledRegistry>
      </body>
    </html>
  );
}
