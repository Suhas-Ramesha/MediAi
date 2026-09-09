import { Link } from "wouter";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6">
      <BrandMark />
      <h1 className="mt-8 font-display text-4xl font-semibold tracking-tight">
        This page is not here
      </h1>
      <p className="mt-3 max-w-[36ch] text-center text-muted-foreground">
        The address does not match a screen in MediAI. Go back to the start page
        or open a consultation if you are signed in.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Back to MediAI</Link>
      </Button>
    </div>
  );
}
