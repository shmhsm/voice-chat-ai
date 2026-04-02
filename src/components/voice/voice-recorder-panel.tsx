"use client";

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
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];
  for (const t of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return "";
}

export function VoiceRecorderPanel() {
  const { isLoaded, isSignedIn } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState(0);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [authGateCopy, setAuthGateCopy] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    setGuestCount(getGuestRecordingCount());
  }, []);

  const guestHasExhausted =
    !isSignedIn && guestCount >= GUEST_FREE_LIMIT;

  const openAuthGate = useCallback(
    (title: string, description: string) => {
      setAuthGateCopy({ title, description });
      setAuthGateOpen(true);
    },
    []
  );

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    }
    stopTracks();
    mediaRecorderRef.current = null;
  }, [stopTracks]);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  const transcribeBlob = useCallback(
    async (blob: Blob, mimeType: string) => {
      setPhase("processing");
      setError(null);
      const fd = new FormData();
      const ext = mimeType.includes("webm")
        ? "webm"
        : mimeType.includes("mp4")
          ? "m4a"
          : "webm";
      fd.append("file", blob, `recording.${ext}`);

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Transcription failed");
      }
      const text = data.text ?? "";
      setTranscript(text);

      if (!isSignedIn) {
        incrementGuestRecordingCount();
        setGuestCount(getGuestRecordingCount());
      } else {
        const durationMs = Math.round(performance.now() - startedAtRef.current);
        await fetch("/api/recordings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: text,
            durationMs,
            mimeType: blob.type || mimeType,
          }),
        }).catch(() => {
          /* optional persistence; ignore network errors in MVP */
        });
      }

      setPhase("idle");
    },
    [isSignedIn]
  );

  const startRecording = useCallback(async () => {
    if (!isLoaded) return;

    if (!isSignedIn && guestCount >= GUEST_FREE_LIMIT) {
      openAuthGate(
        "Sign up to continue",
        "You have used your free guest transcription. Sign in or create an account to keep recording."
      );
      return;
    }

    setError(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const rec = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onerror = () => {
        setError("Recording error");
        setPhase("idle");
        stopTracks();
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || mimeType || "audio/webm",
        });
        void transcribeBlob(blob, rec.mimeType || mimeType || "audio/webm");
      };

      startedAtRef.current = performance.now();
      rec.start(200);
      setPhase("recording");
    } catch {
      setError("Microphone permission is required to record.");
      setPhase("idle");
      stopTracks();
    }
  }, [
    guestCount,
    isLoaded,
    isSignedIn,
    openAuthGate,
    stopTracks,
    transcribeBlob,
  ]);

  const toggleRecord = useCallback(() => {
    if (phase === "recording") {
      stopRecording();
      return;
    }
    if (phase === "idle") {
      void startRecording();
    }
  }, [phase, startRecording, stopRecording]);

  const handleUpgrade = useCallback(async () => {
    if (!isSignedIn) {
      openAuthGate(
        "Sign in to upgrade",
        "Create an account or sign in to subscribe with Stripe Checkout."
      );
      return;
    }
    setUpgradeLoading(true);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Checkout could not start");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setUpgradeLoading(false);
    }
  }, [isSignedIn, openAuthGate]);

  const recordingLabel =
    phase === "recording"
      ? "Recording… tap Stop when finished"
      : phase === "processing"
        ? "Transcribing with Whisper…"
        : "Tap Record to capture audio";

  return (
    <>
      <AppHeader onUpgrade={handleUpgrade} upgradeLoading={upgradeLoading} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Voice to text
          </h1>
          <p className="text-sm text-muted-foreground">
            Record from your microphone, transcribe with OpenAI Whisper, and
            keep history when you sign in.
          </p>
          {!isSignedIn && (
            <p className="text-xs text-muted-foreground">
              Guests get {GUEST_FREE_LIMIT} free transcription
              {GUEST_FREE_LIMIT === 1 ? "" : "s"}.
            </p>
          )}
        </div>

        <Card>
          <CardHeader className="border-b border-border/60">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Recorder</CardTitle>
                <CardDescription>{recordingLabel}</CardDescription>
              </div>
              {phase === "recording" && (
                <Badge variant="outline" className="gap-1 border-destructive/50 text-destructive">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive/60 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-destructive" />
                  </span>
                  Live
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-center">
              <Button
                type="button"
                size="icon-lg"
                variant={phase === "recording" ? "destructive" : "default"}
                className="size-20 rounded-full shadow-md"
                onClick={toggleRecord}
                disabled={!isLoaded || phase === "processing" || guestHasExhausted}
                aria-pressed={phase === "recording"}
              >
                {phase === "processing" ? (
                  <Loader2Icon className="size-8 animate-spin" />
                ) : phase === "recording" ? (
                  <SquareIcon className="size-8 fill-current" />
                ) : (
                  <MicIcon className="size-8" />
                )}
                <span className="sr-only">
                  {phase === "recording" ? "Stop recording" : "Start recording"}
                </span>
              </Button>
              <div className="flex flex-1 flex-col items-center gap-3 text-center sm:items-start sm:text-left">
                <p className="text-sm text-muted-foreground">
                  {guestHasExhausted
                    ? "Guest limit reached — sign in to continue recording."
                    : phase === "idle"
                      ? "Large files may take longer to transcribe."
                      : null}
                </p>
                {guestHasExhausted && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      openAuthGate(
                        "Sign up to continue",
                        "Unlock unlimited recordings by creating an account."
                      )
                    }
                  >
                    Sign up to continue
                  </Button>
                )}
              </div>
            </div>
            {error && (
              <p className="mt-4 text-center text-sm text-destructive sm:text-left" role="alert">
                {error}
              </p>
            )}
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-3 border-t border-border/60">
            <p className="text-xs font-medium text-muted-foreground">
              Transcript
            </p>
            <ScrollArea className="h-48 rounded-lg border border-border bg-muted/30 p-3">
              {transcript ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {transcript}
                </p>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <CircleIcon className="size-8 opacity-40" strokeWidth={1} />
                  <p className="text-sm">No transcript yet</p>
                </div>
              )}
            </ScrollArea>
          </CardFooter>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Pro upgrade uses Stripe Checkout — configure price ID and keys in{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]">
            .env
          </code>
          .
        </p>
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
