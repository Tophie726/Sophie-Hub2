'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Loader2,
  Link2,
  Unlink,
  ShieldAlert,
  Check,
  X,
  ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

interface SlackContact {
  id: string
  name: string
  email: string | null
  image: string | null
  user_type: 'member' | 'multi_channel_guest' | 'single_channel_guest' | 'bot' | 'deactivated' | 'connect'
  mapping_id: string | null
  partner_id: string | null
  partner_name: string | null
  is_primary_contact: boolean
  is_mapped: boolean
  mapped_to_staff: boolean
  staff_name: string | null
}

interface Partner {
  id: string
  brand_name: string
}

type FilterType = 'all' | 'mapped' | 'unmapped' | 'staff_mapped'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]
const PAGE_SIZE = 30

const CONTACT_TYPE_LABEL: Record<SlackContact['user_type'], string> = {
  member: 'Member',
  multi_channel_guest: 'MC Guest',
  single_channel_guest: 'SC Guest',
  connect: 'Slack Connect',
  bot: 'Bot',
  deactivated: 'Deactivated',
}

export function SlackPartnerContactMapping() {
  const [contacts, setContacts] = useState<SlackContact[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [isLoadingContacts, setIsLoadingContacts] = useState(true)
  const [isLoadingPartners, setIsLoadingPartners] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [selectedPartners, setSelectedPartners] = useState<Record<string, string>>({})
  const [savingContactId, setSavingContactId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  async function refreshContacts() {
    const res = await fetch('/api/slack/contacts')
    if (!res.ok) throw new Error('Failed to fetch partner contacts')
    const json = await res.json()
    setContacts(json.data?.contacts || [])
  }

  useEffect(() => {
    async function fetchContacts() {
      try {
        await refreshContacts()
      } catch (err) {
        console.error('Error fetching Slack partner contacts:', err)
        toast.error('Failed to load partner-contact candidates')
      } finally {
        setIsLoadingContacts(false)
      }
    }
    fetchContacts()
  }, [])

  useEffect(() => {
    async function fetchPartners() {
      try {
        const res = await fetch('/api/partners?limit=1000')
        if (!res.ok) throw new Error('Failed to fetch partners')
        const json = await res.json()
        const list = json.data?.partners || json.partners || []
        setPartners(list.map((p: { id: string; brand_name: string }) => ({
          id: p.id,
          brand_name: p.brand_name,
        })))
      } catch (err) {
        console.error('Error fetching partners:', err)
        toast.error('Failed to load partners')
      } finally {
        setIsLoadingPartners(false)
      }
    }
    fetchPartners()
  }, [])

  const filteredContacts = useMemo(() => {
    let filtered = contacts

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(contact =>
        contact.name.toLowerCase().includes(q) ||
        contact.email?.toLowerCase().includes(q) ||
        contact.partner_name?.toLowerCase().includes(q)
      )
    }

    if (filter === 'mapped') filtered = filtered.filter(contact => contact.is_mapped)
    if (filter === 'unmapped') filtered = filtered.filter(contact => !contact.is_mapped)
    if (filter === 'staff_mapped') filtered = filtered.filter(contact => contact.mapped_to_staff)

    return filtered
  }, [contacts, searchQuery, filter])

  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [searchQuery, filter])

  const visibleContacts = filteredContacts.slice(0, visibleCount)
  const hasMore = visibleCount < filteredContacts.length
  const mappedCount = contacts.filter(contact => contact.is_mapped).length
  const staffMappedCount = contacts.filter(contact => contact.mapped_to_staff).length

  async function handleSaveMapping(contactId: string) {
    const partnerId = selectedPartners[contactId]
    if (!partnerId) return

    const contact = contacts.find(c => c.id === contactId)
    setSavingContactId(contactId)

    try {
      const res = await fetch('/api/slack/mappings/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_id: partnerId,
          slack_user_id: contactId,
          slack_user_name: contact?.name,
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error?.message || 'Failed to save mapping')
      }

      toast.success('Partner contact mapping saved')
      await refreshContacts()
      setSelectedPartners(prev => {
        const next = { ...prev }
        delete next[contactId]
        return next
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save mapping')
    } finally {
      setSavingContactId(null)
    }
  }

  async function handleDeleteMapping(contact: SlackContact) {
    if (!contact.mapping_id) {
      toast.error('Mapping ID not found')
      return
    }

    try {
      const res = await fetch(`/api/slack/mappings/contacts?id=${contact.mapping_id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete mapping')

      toast.success('Partner contact mapping removed')
      await refreshContacts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove mapping')
    }
  }

  const isLoading = isLoadingContacts || isLoadingPartners

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading partner-contact candidates...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline">{contacts.length} contacts</Badge>
          <Badge variant="secondary" className="bg-green-500/10 text-green-600">
            {mappedCount} mapped
          </Badge>
          <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">
            {contacts.length - mappedCount} unmapped
          </Badge>
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
            {staffMappedCount} mapped to staff
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="mapped">Mapped</SelectItem>
            <SelectItem value="unmapped">Unmapped</SelectItem>
            <SelectItem value="staff_mapped">Mapped To Staff</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg divide-y max-h-[500px] overflow-y-auto">
        {filteredContacts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No contacts match your filters
          </div>
        ) : (
          visibleContacts.map((contact) => {
            const isSaving = savingContactId === contact.id
            const selectedPartnerId = selectedPartners[contact.id]
            const canMapToPartner = !contact.mapped_to_staff || contact.is_mapped

            return (
              <motion.div
                key={contact.id}
                initial={false}
                animate={{
                  backgroundColor: contact.is_mapped ? 'rgba(34, 197, 94, 0.05)' : 'transparent',
                }}
                transition={{ duration: 0.2, ease: easeOut }}
                className="flex items-center gap-3 p-3 hover:bg-muted/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {contact.is_mapped ? (
                      <Link2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <Unlink className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                    )}
                    <span className="font-medium truncate">{contact.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {CONTACT_TYPE_LABEL[contact.user_type]}
                    </Badge>
                    {contact.mapped_to_staff && (
                      <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-600">
                        Staff mapped
                      </Badge>
                    )}
                    {contact.is_mapped && contact.is_primary_contact && (
                      <Badge variant="outline" className="text-xs border-green-500/30 text-green-600">
                        Primary contact
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate ml-6">{contact.email || 'No email'}</p>
                  {contact.is_mapped && contact.partner_name && (
                    <p className="text-xs text-muted-foreground ml-6">→ {contact.partner_name}</p>
                  )}
                  {!contact.is_mapped && contact.mapped_to_staff && (
                    <p className="text-xs text-blue-600 ml-6 flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" />
                      Already mapped to staff{contact.staff_name ? ` (${contact.staff_name})` : ''}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {contact.is_mapped ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteMapping(contact)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  ) : (
                    <>
                      <Select
                        value={selectedPartnerId || ''}
                        onValueChange={(v) =>
                          setSelectedPartners(prev => ({ ...prev, [contact.id]: v }))
                        }
                        disabled={!canMapToPartner}
                      >
                        <SelectTrigger className="w-[190px] h-8 text-sm">
                          <SelectValue placeholder="Select partner..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {partners.map(partner => (
                            <SelectItem key={partner.id} value={partner.id}>
                              {partner.brand_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="h-8"
                        disabled={!selectedPartnerId || isSaving || !canMapToPartner}
                        onClick={() => handleSaveMapping(contact.id)}
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </motion.div>
            )
          })
        )}

        {hasMore && (
          <button
            onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
            className="w-full p-3 text-sm text-muted-foreground hover:bg-muted/50 flex items-center justify-center gap-2"
          >
            <ChevronDown className="h-4 w-4" />
            Load more ({filteredContacts.length - visibleCount} remaining)
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Map partner-facing Slack users to partner brands. A partner can have multiple mapped contacts;
        the first mapped contact is marked primary by default. Staff-linked Slack users are blocked
        from partner-contact mapping to avoid attribution conflicts.
      </p>
    </div>
  )
}
