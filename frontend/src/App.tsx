import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { Suspense, lazy } from 'react';
import { AppLayout } from './layouts/AppLayout';
import { ThemeProvider } from './components/ThemeProvider';
import { GatewayProvider } from './hooks/useGateway';

// Lazy-loaded pages
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })),
);
const SessionsPage = lazy(() =>
  import('./pages/SessionsPage').then(m => ({ default: m.SessionsPage })),
);
const SessionDetailPage = lazy(() =>
  import('./pages/SessionDetailPage').then(m => ({ default: m.SessionDetailPage })),
);
const CronPage = lazy(() => import('./pages/CronPage').then(m => ({ default: m.CronPage })));
const ChatPage = lazy(() => import('./pages/ChatPage').then(m => ({ default: m.ChatPage })));
const GatewaySettingsPage = lazy(() =>
  import('./pages/GatewaySettingsPage').then(m => ({ default: m.GatewaySettingsPage })),
);
const KanbanPage = lazy(() => import('./pages/KanbanPage').then(m => ({ default: m.KanbanPage })));
const TasksPage = lazy(() => import('./pages/TasksPage').then(m => ({ default: m.TasksPage })));
const TaskDetailPage = lazy(() =>
  import('./pages/TaskDetailPage').then(m => ({ default: m.TaskDetailPage })),
);
const ProjectsPage = lazy(() =>
  import('./pages/ProjectsPage').then(m => ({ default: m.ProjectsPage })),
);
const ProjectDetailPage = lazy(() =>
  import('./pages/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage })),
);
const AnalyticsPage = lazy(() =>
  import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })),
);
const AgentLifecyclePage = lazy(() =>
  import('./pages/AgentLifecyclePage').then(m => ({ default: m.AgentLifecyclePage })),
);
const AgentsPage = lazy(() => import('./pages/AgentsPage').then(m => ({ default: m.AgentsPage })));
const ChannelsPage = lazy(() =>
  import('./pages/ChannelsPage').then(m => ({ default: m.ChannelsPage })),
);
const LogsPage = lazy(() => import('./pages/LogsPage').then(m => ({ default: m.LogsPage })));
const ServicesPage = lazy(() =>
  import('./pages/ServicesPage').then(m => ({ default: m.ServicesPage })),
);
const SkillsPage = lazy(() => import('./pages/SkillsPage').then(m => ({ default: m.SkillsPage })));
const MemoryPage = lazy(() => import('./pages/MemoryPage').then(m => ({ default: m.MemoryPage })));
const UsagePage = lazy(() => import('./pages/UsagePage').then(m => ({ default: m.UsagePage })));
const SecurityPage = lazy(() =>
  import('./pages/SecurityPage').then(m => ({ default: m.SecurityPage })),
);
const ExtensionsPage = lazy(() =>
  import('./pages/ExtensionsPage').then(m => ({ default: m.ExtensionsPage })),
);
const CommunicationPage = lazy(() =>
  import('./pages/CommunicationPage').then(m => ({ default: m.CommunicationPage })),
);
const AgentSkillPage = lazy(() =>
  import('./pages/AgentSkillPage').then(m => ({ default: m.AgentSkillPage })),
);
const ModelSettingsPage = lazy(() =>
  import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })),
);
// Workflow pages
const WorkflowTemplates = lazy(() => import('./pages/workflows/Templates'));
const WorkflowTemplateDetail = lazy(() => import('./pages/workflows/TemplateDetail'));
const WorkflowInstances = lazy(() => import('./pages/workflows/Instances'));
const WorkflowInstanceDetail = lazy(() => import('./pages/workflows/InstanceDetail'));
const WorkflowReviews = lazy(() => import('./pages/workflows/Reviews'));
// Phase 3 pages
const VerificationPage = lazy(() =>
  import('./pages/VerificationPage').then(m => ({ default: m.VerificationPage })),
);
const PluginsPage = lazy(() =>
  import('./pages/PluginsPage').then(m => ({ default: m.PluginsPage })),
);
const TriggersPage = lazy(() =>
  import('./pages/TriggersPage').then(m => ({ default: m.TriggersPage })),
);

function PageLoader() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        minHeight: 200,
      }}
    >
      <div style={{ color: '#94a3b8' }}>Loading...</div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ConfigProvider
          theme={{
            algorithm: antdTheme.darkAlgorithm,
            token: {
              colorPrimary: '#6366f1',
              borderRadius: 8,
              colorBgContainer: '#1e1e2e',
              colorBgElevated: '#262637',
              colorBgLayout: '#13131f',
              colorText: '#e2e8f0',
              colorTextSecondary: '#94a3b8',
              colorBorder: '#2e2e42',
              fontFamily: 'inherit',
            },
            components: {
              Button: { borderRadius: 6 },
              Input: { borderRadius: 6 },
              Select: { borderRadius: 6 },
              Card: { borderRadius: 10 },
              Table: { borderRadius: 8 },
              Modal: { borderRadius: 10 },
            },
          }}
        >
          <GatewayProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path='sessions' element={<SessionsPage />} />
                  <Route path='sessions/:key' element={<SessionDetailPage />} />
                  <Route path='cron' element={<CronPage />} />
                  <Route path='chat' element={<ChatPage />} />
                  <Route path='settings' element={<GatewaySettingsPage />} />
                  <Route path='model-settings' element={<ModelSettingsPage />} />
                  <Route path='kanban' element={<KanbanPage />} />
                  <Route path='tasks' element={<TasksPage />} />
                  <Route path='tasks/:id' element={<TaskDetailPage />} />
                  <Route path='projects' element={<ProjectsPage />} />
                  <Route path='projects/:id' element={<ProjectDetailPage />} />
                  <Route path='analytics/cost' element={<AnalyticsPage />} />
                  <Route path='agents/lifecycle' element={<AgentLifecyclePage />} />
                  <Route path='agents-mgmt' element={<AgentsPage />} />
                  <Route path='channels' element={<ChannelsPage />} />
                  <Route path='logs' element={<LogsPage />} />
                  <Route path='services' element={<ServicesPage />} />
                  <Route path='skills' element={<SkillsPage />} />
                  <Route path='memory' element={<MemoryPage />} />
                  <Route path='usage' element={<UsagePage />} />
                  <Route path='security' element={<SecurityPage />} />
                  <Route path='extensions' element={<ExtensionsPage />} />
                  <Route path='communication' element={<CommunicationPage />} />
                  <Route path='agent-skills' element={<AgentSkillPage />} />
                  <Route path='workflows' element={<WorkflowTemplates />} />
                  <Route path='workflows/template/:id' element={<WorkflowTemplateDetail />} />
                  <Route path='workflows/instances' element={<WorkflowInstances />} />
                  <Route path='workflows/instance/:id' element={<WorkflowInstanceDetail />} />
                  <Route path='workflows/reviews' element={<WorkflowReviews />} />
                  <Route path='verification' element={<VerificationPage />} />
                  <Route path='plugins' element={<PluginsPage />} />
                  <Route path='triggers' element={<TriggersPage />} />
                </Route>
              </Routes>
            </Suspense>
          </GatewayProvider>
        </ConfigProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
