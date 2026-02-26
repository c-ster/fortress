import { Routes, Route } from 'react-router-dom';

export function App() {
  return (
    <div className="min-h-screen">
      <header className="bg-fortress-navy text-white px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight">Fortress</h1>
        <p className="text-sm text-gray-300">Financial Readiness Platform</p>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Routes>
          <Route
            path="/"
            element={
              <div className="text-center py-16">
                <h2 className="text-3xl font-bold text-fortress-navy mb-4">
                  Your Financial Stability Moat
                </h2>
                <p className="text-gray-600 max-w-md mx-auto">
                  Secure financial planning for service members and their families. Get to 80%
                  financial readiness in under 30 minutes.
                </p>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
