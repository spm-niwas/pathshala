import { AdminScannerApp } from './components/AdminScannerApp';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <AdminScannerApp />
    </ErrorBoundary>
  );
}
