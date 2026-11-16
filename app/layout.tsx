import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { GoogleTagManager } from "@next/third-parties/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Peak Aventuras Educativas",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased `}
      >
        {children}
      </body>
      <GoogleTagManager gtmId="GTM-MDBHKTRR" />
      {/* GA4 runs on its own dataLayer ("gaDataLayer"). Sharing GTM's dataLayer
          let GA4 Enhanced Measurement form_start/form_submit (and every gtag
          event) fire GTM's Meta pixel tags again: 4 "Form Submit" per lead.
          @next/third-parties' dataLayerName prop doesn't add "&l=" to the
          script URL, so GA4 is loaded by hand here. */}
      <Script
        id="ga4"
        src="https://www.googletagmanager.com/gtag/js?id=G-KEB6NLTFVS&l=gaDataLayer"
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.gaDataLayer=window.gaDataLayer||[];window.gtag=function(){gaDataLayer.push(arguments);};gtag('js',new Date());gtag('config','G-KEB6NLTFVS');`}
      </Script>
    </html>
  );
}
