import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";

type CreateBody = {
  transcript: string;
  durationMs?: number;
  mimeType?: string;
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as CreateBody;
  if (!body.transcript || typeof body.transcript !== "string") {
    return NextResponse.json({ error: "transcript required" }, { status: 400 });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  const prisma = getPrisma();

  const dbUser = await prisma.user.upsert({
    where: { clerkId: userId },
    create: { clerkId: userId, email },
    update: { email: email ?? undefined },
  });

  const recording = await prisma.recording.create({
    data: {
      userId: dbUser.id,
      transcript: body.transcript,
      durationMs: body.durationMs,
      mimeType: body.mimeType,
    },
  });

  return NextResponse.json(recording);
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = getPrisma();
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: {
      recordings: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  return NextResponse.json({ recordings: dbUser?.recordings ?? [] });
}
