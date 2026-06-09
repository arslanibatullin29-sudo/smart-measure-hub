import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import ProtectedRoute from './ProtectedRoute'
import { Layout } from '../layout/Layout'
import Login from '@/features/auth/screens/Login'
import Register from '@/features/auth/screens/Register'
import CustomersList from '@/features/customers/screens/CustomersList'
import ProjectsList from '@/features/projects/screens/ProjectsList'
import ProjectEditor from '@/features/projects/screens/ProjectEditor'
import ProjectEstimate from '@/features/projects/screens/ProjectEstimate'
import ProfilesList from '@/features/profiles/screens/ProfilesList'
import OrganizationSettings from '@/features/organizations/screens/OrganizationSettings'
import MembersList from '@/features/organizations/screens/MembersList'
import AcceptInvite from '@/features/organizations/screens/AcceptInvite'

function AppRouter() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div>Загрузка...</div>
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={user ? <Navigate to="/customers" replace /> : <Login />} 
      />
      <Route 
        path="/register" 
        element={user ? <Navigate to="/customers" replace /> : <Register />} 
      />
      <Route
        path="/customers"
        element={
          <ProtectedRoute>
            <Layout>
              <CustomersList />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers/:customerId/projects"
        element={
          <ProtectedRoute>
            <Layout>
              <ProjectsList />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers/:customerId/projects/new"
        element={
          <ProtectedRoute>
            <Layout>
              <ProjectEditor />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers/:customerId/projects/:projectId"
        element={
          <ProtectedRoute>
            <Layout>
              <ProjectEditor />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers/:customerId/projects/:projectId/edit"
        element={
          <ProtectedRoute>
            <Layout>
              <ProjectEditor />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers/:customerId/projects/:projectId/estimate"
        element={
          <ProtectedRoute>
            <Layout>
              <ProjectEstimate />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profiles"
        element={
          <ProtectedRoute>
            <Layout>
              <ProfilesList />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/organization/settings"
        element={
          <ProtectedRoute>
            <Layout>
              <OrganizationSettings />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/organization/members"
        element={
          <ProtectedRoute>
            <Layout>
              <MembersList />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/" element={<Navigate to={user ? "/customers" : "/login"} replace />} />
    </Routes>
  )
}

export default AppRouter

