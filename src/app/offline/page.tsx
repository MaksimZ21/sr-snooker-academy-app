export default function Offline() {
  return (
    <main className="min-h-screen grid place-items-center p-4 text-center">
      <div>
        <h1 className="bc-num text-[28px] md:text-[36px] leading-[1.05] mb-2">אין חיבור לאינטרנט</h1>
        <p className="text-muted-foreground">נסה שוב כשהחיבור יחזור.</p>
      </div>
    </main>
  );
}
