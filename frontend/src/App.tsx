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
import { TaskDetailPage } from './pages/TaskDetailPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { AgentLifecyclePage } from './pages/AgentLifecyclePage'
import { AgentsPage } from './pages/AgentsPage'
import { ChannelsPage } from './pages/ChannelsPage'
import { LogsPage } from './pages/LogsPage'
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
              <Route path="tasks/:id" element={<TaskDetailPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="projects/:id" element={<ProjectDetailPage />} />
              <Route path="analytics/cost" element={<AnalyticsPage />} />
              <Route path="agents/lifecycle" element={<AgentLifecyclePage />} />
              <Route path="agents-mgmt" element={<AgentsPage />} />
              <Route path="channels" element={<ChannelsPage />} />
              <Route path="logs" element={<LogsPage />} />
            </Route>
          </Routes>
        </GatewayProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
