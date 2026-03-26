import { Suspense } from "react";
import ContactForm from "@/components/ContactForm";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <section className="flex flex-col justify-center items-center gap-5 bg-white min-h-dvh">
      <Link href={"https://peaktravel.com.ar/"}>
        <Image
          src={"/peak_logo.png"}
          alt="Peak Aventuras Educativas"
          width={500}
          height={500}
        />
      </Link>

      <Suspense>
        <ContactForm />
      </Suspense>
    </section>
  );
}
