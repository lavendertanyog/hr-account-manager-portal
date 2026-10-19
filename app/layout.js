import './globals.css';
import AppShell from './AppShell';
import { LanguageProvider } from './i18n/LanguageProvider';

export const metadata = {
  title: 'Account Manager Portal',
  description: 'Approval workspace for project allocations',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <AppShell>{children}</AppShell>
        </LanguageProvider>
      </body>
    </html>
  );
}
