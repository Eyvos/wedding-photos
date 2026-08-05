import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

import { COUPLE, WEDDING } from "@/lib/config";

// Serif haute et fine pour les titres : le versant « chic »
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

// Sans-serif neutre pour l'interface : lisible sur un téléphone, en soirée
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Base des URL absolues des balises de partage. `NEXT_PUBLIC_SITE_URL` d'abord
 * (le domaine définitif), sinon l'URL que Vercel attribue au déploiement.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

const title = `Photos du mariage — ${COUPLE}`;
const description = `Partage tes photos du mariage d'${COUPLE}, le ${WEDDING.dateLabel.toLowerCase()}. Pas de compte, pas d'application : choisis tes photos, c'est envoyé.`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    locale: "fr_FR",
    siteName: title,
  },
  twitter: { card: "summary_large_image", title, description },
  // Une galerie privée n'a rien à faire dans Google
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#faf6ee",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      data-theme="rustique"
      className={`${cormorant.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
