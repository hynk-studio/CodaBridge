import { useCallback, useState } from "react";

type Tone = "info" | "warning";
type Message = { text: string; tone: Tone } | null;

export function useNotice(text = "", tone: Tone = "info") {
  const [message, update] = useState<Message>(text ? { text, tone } : null);
  const setNotice = useCallback((text: string, tone: Tone = "info") => {
    update(text ? { text, tone } : null);
  }, []);
  return [message, setNotice] as const;
}

export default function Notice({ message, className = "" }: { message: Message; className?: string }) {
  return message && <p className={`notice ${className}`} data-tone={message.tone}
    role={message.tone === "warning" ? "alert" : "status"}>{message.text}</p>;
}
