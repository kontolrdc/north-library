import type { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <section className="admin-shell min-vh-100">
      <div className="container py-4">{children}</div>
    </section>
  );
}
