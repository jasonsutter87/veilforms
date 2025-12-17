import type { Metadata } from "next";
import "@/styles/globals.scss";

export const metadata: Metadata = {
  title: {
    default: "VeilForms Dashboard",
    template: "%s | VeilForms",
  },
  description: "Privacy-first form builder with client-side encryption",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
