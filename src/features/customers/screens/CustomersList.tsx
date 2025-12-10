import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCustomers } from '../hooks/useCustomers'
import CustomerForm from '../components/CustomerForm'
import { CustomerFormData } from '../models/Customer'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { LoadingBar } from '@/components/LoadingBar'
import { Plus, FolderOpen, Edit, Trash2, MapPin, Phone, MessageSquare } from 'lucide-react'

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
    if (confirm('Удалить клиента?')) {
      await deleteCustomer(id)
    }
  }

  return (
    <div className="w-full animate-fade-in">
      <LoadingBar isLoading={isLoading || isCreating || isDeleting} />
      
      {/* Компактный заголовок */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Клиенты</h1>
          <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Управление базой клиентов</p>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Добавить</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-3 sm:p-4">
                <Skeleton className="h-5 w-3/4 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3 mb-3" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-8 sm:py-12">
          <p className="text-muted-foreground mb-4 text-sm">Нет клиентов</p>
          <Button onClick={() => setShowForm(true)} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Добавить первого
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((customer) => (
            <Card key={customer.id} className="group hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:p-4">
                <div className="mb-3">
                  <h3 className="font-semibold text-sm sm:text-base truncate">{customer.fullName}</h3>
                  
                  {customer.address && (
                    <p className="text-xs sm:text-sm text-muted-foreground flex items-start gap-1.5 mt-1.5">
                      <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-2">{customer.address}</span>
                    </p>
                  )}
                  
                  {customer.phone && (
                    <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                      <Phone className="h-3 w-3 flex-shrink-0" />
                      {customer.phone}
                    </p>
                  )}
                  
                  {customer.comment && (
                    <p className="text-xs text-muted-foreground flex items-start gap-1.5 mt-1.5 italic">
                      <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-2">{customer.comment}</span>
                    </p>
                  )}
                </div>
                
                <div className="flex gap-1.5 sm:gap-2">
                  <Button
                    onClick={() => navigate(`/customers/${String(customer.id!)}/projects`)}
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs sm:text-sm"
                  >
                    <FolderOpen className="h-3.5 w-3.5 mr-1" />
                    Объекты
                  </Button>
                  <Button
                    onClick={() => setEditingCustomer({ 
                      id: String(customer.id!), 
                      data: { 
                        fullName: customer.fullName, 
                        address: customer.address, 
                        phone: customer.phone, 
                        comment: customer.comment 
                      } 
                    })}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    onClick={() => handleDelete(String(customer.id!))}
                    disabled={isDeleting}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog для добавления клиента */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">Добавить клиента</DialogTitle>
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
        <DialogContent className="max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">Редактировать клиента</DialogTitle>
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
