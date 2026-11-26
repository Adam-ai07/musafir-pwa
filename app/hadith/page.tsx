"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HadithRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/hadiths");
  }, [router]);

  return null;
}
