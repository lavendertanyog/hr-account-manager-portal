import './globals.css';
import AppShell from './AppShell';

export const metadata = {
  title: 'Account Manager Portal',
  description: 'Approval workspace for project allocations',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
