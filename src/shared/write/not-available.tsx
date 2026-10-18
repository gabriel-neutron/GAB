export function NotAvailable() {
  return (
    <div className="flex h-full flex-col items-start gap-2 p-4">
      <p>This part is not available here.</p>
      <a
        href="/map"
        className="text-xs text-label underline outline-none hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Go to the map
      </a>
    </div>
  );
}
