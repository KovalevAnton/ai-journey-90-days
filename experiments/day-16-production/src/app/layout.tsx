import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Chat with The Bro Code",
  description:
    "Ask Barney Stinson's AI anything about The Bro Code — in any language. Built with RAG.",
  openGraph: {
    title: "Chat with The Bro Code",
    description:
      "Ask Barney Stinson's AI anything about The Bro Code — in any language.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
