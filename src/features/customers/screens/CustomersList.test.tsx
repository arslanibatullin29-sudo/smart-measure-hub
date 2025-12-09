import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/test-utils'
import CustomersList from './CustomersList'
import { useCustomers } from '../hooks/useCustomers'
import { useAuth } from '@/features/auth/hooks/useAuth'

// Мокируем хуки и компоненты
vi.mock('../hooks/useCustomers')
vi.mock('@/features/auth/hooks/useAuth')
vi.mock('@/features/sync/components/SyncStatus', () => ({
  default: () => <div data-testid="sync-status">Sync Status</div>,
}))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

const mockUseCustomers = vi.mocked(useCustomers)
const mockUseAuth = vi.mocked(useAuth)

describe('CustomersList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' },
      loading: false,
    } as any)
  })

  it('should render loading state', () => {
    mockUseCustomers.mockReturnValue({
      customers: [],
      isLoading: true,
      createCustomer: vi.fn(),
      updateCustomer: vi.fn(),
      deleteCustomer: vi.fn(),
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
    } as any)

    render(<CustomersList />)
    expect(screen.getByText(/загрузка/i)).toBeInTheDocument()
  })

  it('should render empty state when no customers', () => {
    mockUseCustomers.mockReturnValue({
      customers: [],
      isLoading: false,
      createCustomer: vi.fn(),
      updateCustomer: vi.fn(),
      deleteCustomer: vi.fn(),
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
    } as any)

    render(<CustomersList />)
    expect(screen.getByText(/нет клиентов/i)).toBeInTheDocument()
  })

  it('should render list of customers', () => {
    mockUseCustomers.mockReturnValue({
      customers: [
        {
          id: '1',
          userId: 'user-1',
          fullName: 'John Doe',
          address: '123 Main St',
          phone: '+1234567890',
          comment: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastSyncedAt: null,
          syncStatus: 'synced',
        },
        {
          id: '2',
          userId: 'user-1',
          fullName: 'Jane Smith',
          address: '456 Oak Ave',
          phone: '+0987654321',
          comment: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastSyncedAt: null,
          syncStatus: 'synced',
        },
      ],
      isLoading: false,
      createCustomer: vi.fn(),
      updateCustomer: vi.fn(),
      deleteCustomer: vi.fn(),
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
    } as any)

    render(<CustomersList />)
    
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    // Адрес отображается с эмодзи "📍 "
    expect(screen.getByText(/123 Main St/)).toBeInTheDocument()
    expect(screen.getByText(/456 Oak Ave/)).toBeInTheDocument()
    // Телефон отображается с эмодзи "📞 "
    expect(screen.getByText(/\+1234567890/)).toBeInTheDocument()
    expect(screen.getByText(/\+0987654321/)).toBeInTheDocument()
  })
})

