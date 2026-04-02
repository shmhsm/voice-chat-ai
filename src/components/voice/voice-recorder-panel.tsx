"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { CircleIcon, Loader2Icon, MicIcon, SquareIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/voice/app-header";
import { AuthGateDialog } from "@/components/voice/auth-gate-dialog";
import {
  GUEST_FREE_LIMIT,
  getGuestRecordingCount,
  incrementGuestRecordingCount,
} from "@/lib/guest-recording";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

type Phase = "idle" | "recording" | "processing";

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

export function VoiceRecorderPanel() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState(0);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [authGateCopy, setAuthGateCopy] = useState<{ title: string; description: string } | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    setGuestCount(getGuestRecordingCount());
  }, []);

  // УСЛОВИЕ ЛИМИТА: Теперь проверяем просто счетчик, неважно вошли мы или нет
  const hasExhaustedLimit = guestCount >= GUEST_FREE_LIMIT;

  const openAuthGate = useCallback((title: string, description: string) => {
    setAuthGateCopy({ title, description });
    setAuthGateOpen(true);
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    stopTracks();
  }, [stopTracks]);

  const transcribeBlob = useCallback(async (blob: Blob, mimeType: string) => {
    setPhase("processing");
    setError(null);
    const fd = new FormData();
    const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "m4a" : "webm";
    fd.append("file", blob, `recording.${ext}`);

    try {
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Transcription failed");
      
      const text = data.text ?? "";
      setTranscript(text);

      // Увеличиваем счетчик в любом случае для теста
      incrementGuestRecordingCount();
      setGuestCount(getGuestRecordingCount());

      if (isSignedIn) {
        const durationMs = Math.round(performance.now() - startedAtRef.current);
        await fetch("/api/recordings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: text, durationMs, mimeType: blob.type || mimeType }),
        }).catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
    setPhase("idle");
  }, [isSignedIn]);

  const startRecording = useCallback(async () => {
    if (!isLoaded) return;

    // Если лимит исчерпан — показываем всплывающее окно
    if (hasExhaustedLimit) {
      openAuthGate(
        "План PRO необходим",
        "Вы использовали свою бесплатную попытку. Пожалуйста, оформите подписку PRO, чтобы записывать без ограничений."
      );
      return;
    }

    setError(null);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        void transcribeBlob(blob, rec.mimeType || "audio/webm");
      };
      startedAtRef.current = performance.now();
      rec.start(200);
      setPhase("recording");
    } catch {
      setError("Микрофон недоступен.");
      setPhase("idle");
    }
  }, [isLoaded, hasExhaustedLimit, openAuthGate, transcribeBlob]);

  const toggleRecord = () => phase === "recording" ? stopRecording() : void startRecording();

  return (
    <>
      <AppHeader onUpgrade={() => router.push("/payments")} upgradeLoading={upgradeLoading} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Голосовой ввод</h1>
          <p className="text-sm text-muted-foreground">Бесплатно: 1 запись.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Запись</CardTitle>
            <CardDescription>
              {hasExhaustedLimit ? "Лимит исчерпан" : "Нажмите для начала"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Button
              size="icon"
              variant={phase === "recording" ? "destructive" : "default"}
              className="size-20 rounded-full"
              onClick={toggleRecord}
              disabled={phase === "processing"}
            >
              {phase === "processing" ? <Loader2Icon className="animate-spin" /> : phase === "recording" ? <SquareIcon /> : <MicIcon />}
            </Button>
            {hasExhaustedLimit && (
              <p className="text-sm text-destructive font-medium">Требуется план PRO</p>
            )}
          </CardContent>
          <CardFooter className="flex-col items-stretch border-t p-4">
            <ScrollArea className="h-32 rounded-md border bg-muted/30 p-3 text-sm">
              {transcript || "Текст появится здесь..."}
            </ScrollArea>
          </CardFooter>
        </Card>
      </main>

      <AuthGateDialog 
        open={authGateOpen} 
        onOpenChange={setAuthGateOpen} 
        title={authGateCopy?.title} 
        description={authGateCopy?.description} 
      />
    </>
  );
}