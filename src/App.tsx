import { Routes, Route, Navigate } from 'react-router-dom'
import { CommandPalette } from '@/components/common/CommandPalette'
import { useAuth } from '@/context/AuthContext'
import { FullScreenLayout } from '@/layouts/FullScreenLayout'
import { MainLayout } from '@/layouts/MainLayout'
import { AdminPage } from '@/pages/AdminPage'
import { ClientPortal } from '@/pages/ClientPortal'
import { ConsultantProfilePage } from '@/pages/ConsultantProfilePage'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { LogrosPage } from '@/pages/LogrosPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { ProjectPage } from '@/pages/ProjectPage'
import { SplashPage } from '@/pages/SplashPage'
import { RetroPage } from '@/pages/RetroPage'
import { TeamOverview } from '@/pages/TeamOverview'
import { TimeTrackerPage } from '@/pages/TimeTrackerPage'
import { ProjectsOverview } from '@/pages/ProjectsOverview'
import { RisksOverview } from '@/pages/RisksOverview'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/welcome" replace />
  return <>{children}</>
}

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-[#007AFF] via-[#3B82F6] to-[#5856D6]">
      <div className="text-center">
        <div className="mx-auto mb-3 w-14 h-14 rounded-xl bg-white dark:bg-revelio-dark-card/10 border border-white/20 flex items-center justify-center animate-pulse">
          <span className="font-logo text-2xl text-white">r</span>
        </div>
        <p className="font-logo text-xl text-white/60">revelio</p>
      </div>
    </div>
  )
}

export function App() {
  return (
    <>
      <CommandPalette />
      <Routes>
      <Route path="/welcome" element={<SplashPage />} />
      <Route path="/login" element={<LoginPage />} />
      {/* App pages with sidebar */}
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/" element={<HomePage />} />
        <Route path="/proyectos" element={<ProjectsOverview />} />
        <Route path="/equipo" element={<TeamOverview />} />
        <Route path="/riesgos" element={<RisksOverview />} />
        <Route path="/logros" element={<LogrosPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/fichaje" element={<TimeTrackerPage />} />
        <Route path="/persona/:id" element={<ConsultantProfilePage />} />
      </Route>
      {/* Full-screen pages (no sidebar) */}
      <Route element={<ProtectedRoute><FullScreenLayout /></ProtectedRoute>}>
        <Route path="/project/:slug" element={<ProjectPage />} />
        <Route path="/project/:slug/retro" element={<RetroPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="/portal/:slug" element={<ClientPortal />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}
