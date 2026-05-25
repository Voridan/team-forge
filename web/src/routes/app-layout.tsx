import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/app/sidebar';
import { TopBar } from '@/components/app/top-bar';
import { InCallModal } from '@/features/calls/in-call-modal';
import { IncomingCallToast } from '@/features/calls/incoming-call-toast';

export function AppLayout() {
  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto bg-background px-6 py-6 sm:px-8">
          <Outlet />
        </main>
      </div>
      <IncomingCallToast />
      <InCallModal />
    </div>
  );
}
