"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckIcon } from "lucide-react";
import Link from "next/link";

export default function PaymentsPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">План PRO</CardTitle>
          <CardDescription>Ваш бесплатный лимит исчерпан</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-4xl font-bold font-heading">$9.99<span className="text-sm font-normal text-muted-foreground">/мес</span></div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2"><CheckIcon className="size-4 text-green-500" /> Безлимитные записи</li>
            <li className="flex items-center gap-2"><CheckIcon className="size-4 text-green-500" /> Хранение истории в облаке</li>
            <li className="flex items-center gap-2"><CheckIcon className="size-4 text-green-500" /> Приоритетная обработка Groq</li>
          </ul>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button className="w-full" size="lg" onClick={() => alert("Интеграция со Stripe будет в следующем модуле! ;)")}>
            Оплатить сейчас
          </Button>
          <Link href="/" className="text-xs text-center text-muted-foreground hover:underline w-full">
            Вернуться назад
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}