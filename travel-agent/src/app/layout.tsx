import type { Metadata } from "next";
import { Inter, Outfit, Source_Code_Pro } from "next/font/google";
import Providers from "@/components/Providers";
import "./globals.css";

// Type scale used across basistheory.com:
//  - Inter for body text
//  - Outfit for display / headings
//  - Source Code Pro for monospace + code
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});
const sourceCodePro = Source_Code_Pro({
  variable: "--font-source-code-pro",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SkyAgent — agentic flight booking",
  description:
    "A Basis Theory agentic commerce demo: chat-driven flight search, agent-issued virtual card credentials, and a simulated airline checkout.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} ${sourceCodePro.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
