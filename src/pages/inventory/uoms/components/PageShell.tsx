export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex bg-slate-50 text-slate-900">{children}</div>
  );
}
