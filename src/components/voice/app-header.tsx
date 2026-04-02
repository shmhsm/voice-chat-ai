"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { Loader2Icon, Mic2Icon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type AppHeaderProps = {
  onUpgrade: () => void | Promise<void>;
  upgradeLoading?: boolean;
};

export function AppHeader({ onUpgrade, upgradeLoading }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Mic2Icon className="size-4" aria-hidden />
          </div>
          <div className="leading-tight">
            <p className="font-heading text-sm font-semibold tracking-tight">
              Voise
            </p>
            <p className="text-xs text-muted-foreground">Voice → text</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={() => void onUpgrade()}
            disabled={upgradeLoading}
          >
            {upgradeLoading ? (
              <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <SparklesIcon className="size-3.5" aria-hidden />
            )}
            Upgrade to Pro
          </Button>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button type="button" variant="outline" size="sm">
                Sign in
              </Button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </div>
    </header>
  );
}
