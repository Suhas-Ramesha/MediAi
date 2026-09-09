import { BrandMark } from "@/components/BrandMark";

export default function Footer() {
  return (
    <footer className="border-t border-border py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-6 lg:px-8">
        <BrandMark />
        <p>© {new Date().getFullYear()} MediAI. Not a diagnostic device.</p>
      </div>
    </footer>
  );
}
