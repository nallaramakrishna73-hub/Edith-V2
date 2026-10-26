import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/AppLayout.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { Chat } from './pages/Chat.tsx';
import { History } from './pages/History.tsx';
import { Settings } from './pages/Settings.tsx';
import { About } from './pages/About.tsx';
import { TasksPage } from './pages/TasksPage.tsx';
import { TerminalPage } from './pages/TerminalPage.tsx';
import { VaultPage } from './pages/VaultPage.tsx';
import { KaliBridgePage } from './pages/KaliBridgePage.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/kali" element={<KaliBridgePage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/terminal" element={<TerminalPage />} />
          <Route path="/vault" element={<VaultPage />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/:id" element={<Chat />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
