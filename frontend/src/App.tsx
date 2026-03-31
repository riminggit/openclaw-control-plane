import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { SessionsPage } from './pages/SessionsPage'
import { SessionDetailPage } from './pages/SessionDetailPage'
import { CronPage } from './pages/CronPage'
import { ChatPage } from './pages/ChatPage'
import { GatewaySettingsPage } from './pages/GatewaySettingsPage'
import { KanbanPage } from './pages/KanbanPage'
import { TasksPage } from './pages/TasksPage'
import { ThemeProvider } from './components/ThemeProvider'
import { GatewayProvider } from './hooks/useGateway'

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <GatewayProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="sessions" element={<SessionsPage />} />
              <Route path="sessions/:key" element={<SessionDetailPage />} />
              <Route path="cron" element={<CronPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="settings" element={<GatewaySettingsPage />} />
              <Route path="kanban" element={<KanbanPage />} />
              <Route path="tasks" element={<TasksPage />} />
            </Route>
          </Routes>
        </GatewayProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
