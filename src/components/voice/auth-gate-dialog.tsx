"use client";

import { SignIn } from "@clerk/nextjs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AuthGateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
};

const DEFAULT_TITLE = "Sign up to continue";
const DEFAULT_DESCRIPTION =
  "You have used your free guest transcription. Sign in or create an account to keep recording with Voise.";

export function AuthGateDialog({
  open,
  onOpenChange,
  title,
  description,
}: AuthGateDialogProps) {
  const resolvedTitle = title ?? DEFAULT_TITLE;
  const resolvedDescription = description ?? DEFAULT_DESCRIPTION;

  return (
    <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-[28rem]"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>{resolvedTitle}</DialogTitle>
          <DialogDescription>{resolvedDescription}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center px-0 py-2">
          <SignIn
            routing="hash"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none",
              },
            }}
            forceRedirectUrl="/"
            signUpForceRedirectUrl="/"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
