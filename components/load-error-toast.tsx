"use client";

import { useEffect } from "react";
import { useToast } from "@/lib/toast-context";

export default function LoadErrorToast({ message }: { message: string }) {
  const { showToast } = useToast();

  useEffect(() => {
    showToast(message, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
