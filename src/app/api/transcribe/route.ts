import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }


  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });

 
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const upload = new File(
    [buffer],
    file.name || "recording.webm",
    { type: file.type || "audio/webm" }
  );

  const transcription = await openai.audio.transcriptions.create({
    file: upload,
    model: "whisper-large-v3-turbo",
  });

  return NextResponse.json({ text: transcription.text });
}