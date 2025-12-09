import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCustomers } from '../hooks/useCustomers'
import CustomerForm from '../components/CustomerForm'
import { CustomerFormData } from '../models/Customer'
import SyncStatus from '@/features/sync/components/SyncStatus'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, FolderOpen, Edit, Trash2 } from 'lucide-react'

function CustomersList() {
  const navigate = useNavigate()
  const { customers, isLoading, createCustomer, updateCustomer, deleteCustomer, isCreating, isDeleting } = useCustomers()
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<{ id: string; data: CustomerFormData } | null>(null)

  const handleCreate = async (data: CustomerFormData) => {
    await createCustomer(data)
    setShowForm(false)
  }

  const handleEdit = async (data: CustomerFormData) => {
    if (editingCustomer) {
      await updateCustomer({ id: editingCustomer.id, data })
      setEditingCustomer(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Вы уверены, что хотите удалить этого клиента?')) {
      await deleteCustomer(id)
    }
  }


  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Клиенты</h1>
          <p className="text-muted-foreground">Управление базой клиентов</p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Добавить клиента
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Нет клиентов</p>
          <Button
            onClick={() => setShowForm(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Добавить первого клиента
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {customers.map((customer) => (
            <Card key={customer.id} className="flex flex-col">
              <CardContent className="p-6 flex flex-col flex-1">
                <div className="flex-1 mb-4">
                  <h3 className="text-lg font-semibold mb-2 break-words">{customer.fullName}</h3>
                  {customer.address && (
                    <p className="text-sm text-muted-foreground mb-1 break-words">📍 {customer.address}</p>
                  )}
                  {customer.phone && (
                    <p className="text-sm text-muted-foreground mb-1">📞 {customer.phone}</p>
                  )}
                  {customer.comment && (
                    <p className="text-sm text-muted-foreground italic mt-2 break-words">{customer.comment}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    onClick={() => navigate(`/customers/${String(customer.id!)}/projects`)}
                    className="flex-1 min-w-0"
                    size="sm"
                    variant="outline"
                  >
                    <FolderOpen className="h-4 w-4 mr-1" />
                    Проекты
                  </Button>
                  <Button
                    onClick={() => setEditingCustomer({ id: String(customer.id!), data: { fullName: customer.fullName, address: customer.address, phone: customer.phone, comment: customer.comment } })}
                    variant="secondary"
                    size="sm"
                    className="flex-shrink-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => handleDelete(String(customer.id!))}
                    disabled={isDeleting}
                    variant="destructive"
                    size="sm"
                    className="flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-3 flex-shrink-0">
                  <SyncStatus status={customer.syncStatus || 'pending'} lastSyncedAt={customer.lastSyncedAt} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog для добавления клиента */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Добавить клиента</DialogTitle>
          </DialogHeader>
          <CustomerForm
            onSubmit={async (data) => {
              await handleCreate(data)
              setShowForm(false)
            }}
            onCancel={() => setShowForm(false)}
            isLoading={isCreating}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog для редактирования клиента */}
      <Dialog open={!!editingCustomer} onOpenChange={(open) => !open && setEditingCustomer(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактировать клиента</DialogTitle>
          </DialogHeader>
          {editingCustomer && (
            <CustomerForm
              initialData={editingCustomer.data}
              onSubmit={async (data) => {
                await handleEdit(data)
                setEditingCustomer(null)
              }}
              onCancel={() => setEditingCustomer(null)}
              isLoading={isCreating}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CustomersList

