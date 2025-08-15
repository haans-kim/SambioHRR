'use client';

import { Sidebar } from '@/components/navigation/Sidebar';
import EnterpriseView from '@/components/dashboard/EnterpriseView';

export default function EnterprisePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content Area */}
      <div className="flex-1 ml-64">
        <EnterpriseView />
      </div>
    </div>
  );
}