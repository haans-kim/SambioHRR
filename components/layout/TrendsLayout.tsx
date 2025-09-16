"use client";

interface TrendsLayoutProps {
  children: React.ReactNode;
}

export function TrendsLayout({ children }: TrendsLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content Area */}
      <div className="flex-1">
        {/* Title Section */}
        <div className="bg-gradient-to-br from-blue-50 to-white border-b border-gray-200">
          <div className="max-w-[1600px] mx-auto px-6 py-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              트렌드 분석
            </h1>
            <p className="text-gray-600">
              실시간 업무패턴 분석 및 근무 추정시간 모니터링
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}