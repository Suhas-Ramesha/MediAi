export default function Footer() {
  return (
    <footer className="border-t border-border bg-background py-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:px-6 md:flex-row lg:px-8">
        <p className="font-medium text-foreground">MediAI</p>
        <p>© {new Date().getFullYear()} MediAI. Not a diagnostic device.</p>
        <div className="flex gap-4">
          <span>Privacy</span>
          <span>Terms</span>
        </div>
      </div>
    </footer>
  );
}
