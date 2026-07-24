export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-full px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-accent tracking-tight">OnTrack</h1>
          <p className="mt-1 text-sm text-muted">Veranstaltungstechnik im Griff</p>
        </div>
        {children}
      </div>
    </div>
  );
}
