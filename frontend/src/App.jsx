import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut, SignIn, SignUp, RedirectToSignIn } from '@clerk/clerk-react';
import Dashboard from './pages/Dashboard';
import WorkflowEditor from './pages/WorkflowEditor';
import RunHistory from './pages/RunHistory';
import RunDetail from './pages/RunDetail';
import Settings from './pages/Settings';
import Layout from './components/Layout';

const ProtectedRoute = ({ children }) => {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login/*" element={
          <div className="flex h-screen w-full items-center justify-center bg-gray-50">
            <SignIn routing="path" path="/login" signUpUrl="/signup" />
          </div>
        } />
        <Route path="/signup/*" element={
          <div className="flex h-screen w-full items-center justify-center bg-gray-50">
            <SignUp routing="path" path="/signup" signInUrl="/login" />
          </div>
        } />
        
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="workflows/:id" element={<WorkflowEditor />} />
          <Route path="workflows/:id/history" element={<RunHistory />} />
          <Route path="workflows/:id/runs/:runId" element={<RunDetail />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
