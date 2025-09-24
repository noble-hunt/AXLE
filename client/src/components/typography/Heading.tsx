export function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="text-3xl font-bold tracking-tight text-white mb-4">{children}</h1>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  // Match the size of PageTitle as requested
  return <h2 className="text-3xl font-bold tracking-tight text-white mb-4">{children}</h2>;
}