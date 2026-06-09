import { useOrganization } from '../contexts/OrganizationProvider'

export default function OrgSwitcher() {
  const { memberships, activeOrgId, setActiveOrgId } = useOrganization()
  if (memberships.length <= 1) return null
  return (
    <select
      value={activeOrgId || ''}
      onChange={e => setActiveOrgId(e.target.value)}
      className="px-2 py-1 text-sm rounded border border-input bg-background"
    >
      {memberships.map(m => (
        <option key={m.organization_id} value={m.organization_id}>
          {m.organization.name}
        </option>
      ))}
    </select>
  )
}
