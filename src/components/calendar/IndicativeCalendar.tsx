import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card,
  Calendar,
  Badge,
  Typography,
  Space,
  Modal,
  Descriptions,
  Empty,
  Divider,
  Grid,
  Button,
  Tooltip,
  Spin,
  Tag,
  List,
  message,
  Segmented
} from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  limit
} from 'firebase/firestore'
import { db } from '@/firebase'
import {
  CalendarOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  FilePdfOutlined
} from '@ant-design/icons'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'

const { Text, Title } = Typography

/** 🔒 ONLY reads from 'indicativeCalender' */
type IndicativeEntry = {
  id: string
  participantId: string
  beneficiaryName?: string
  interventionId: string
  interventionTitle?: string
  areaOfSupport?: string
  type?: 'singular' | 'grouped'
  targetDate?: Dayjs
  implementationDate?: Dayjs
  isRecurring?: boolean
  frequency?: string | null
  subtitle?: string | null
  coordinatorId?: string | null
  coordinatorName?: string | null
  companyCode?: string | null
  status?: string | null
}

/** UI items after aggregation */
type ParticipantMini = { id: string; name?: string }
type BaseFields = {
  interventionId: string
  interventionTitle?: string
  areaOfSupport?: string
  subtitle?: string | null
  coordinatorId?: string | null
  coordinatorName?: string | null
  isRecurring?: boolean
  frequency?: string | null
  status?: string | null
}

type GroupedCalendarItem = {
  kind: 'grouped'
  idKey: string
  date: Dayjs
  base: BaseFields
  participants: ParticipantMini[]
  entries: IndicativeEntry[]
}

type SingleCalendarItem = {
  kind: 'single'
  idKey: string
  date: Dayjs
  base: BaseFields
  participant: ParticipantMini
  entry: IndicativeEntry
}

type CalendarItem = GroupedCalendarItem | SingleCalendarItem

function tsToDayjs (ts: any | Timestamp | undefined): Dayjs | undefined {
  if (!ts) return undefined
  if (ts instanceof Timestamp) return dayjs(ts.toDate())
  if (typeof ts?.toDate === 'function') return dayjs(ts.toDate())
  try {
    const d = new Date(ts)
    return isNaN(+d) ? undefined : dayjs(d)
  } catch {
    return undefined
  }
}

function statusAggregate (statuses: Array<string | null | undefined>) {
  const s = statuses.map(v => (v || 'planned').toLowerCase())
  const uniq = new Set(s)
  if (uniq.size === 1) return s[0]
  return 'processing'
}

/** Reusable aggregation (same logic your calendar uses) */
function buildItemsByDate (entries: IndicativeEntry[]) {
  const map = new Map<string, CalendarItem[]>()
  const groupedIndex = new Map<string, GroupedCalendarItem>()

  const push = (dayKey: string, item: CalendarItem) => {
    const arr = map.get(dayKey) || []
    arr.push(item)
    map.set(dayKey, arr)
  }

  for (const r of entries) {
    const d = r.implementationDate || r.targetDate
    if (!d) continue
    const dayKey = d.format('YYYY-MM-DD')

    const base: BaseFields = {
      interventionId: r.interventionId,
      interventionTitle: r.interventionTitle,
      areaOfSupport: r.areaOfSupport,
      subtitle: r.subtitle ?? null,
      coordinatorId: r.coordinatorId ?? null,
      coordinatorName: r.coordinatorName ?? null,
      isRecurring: r.isRecurring,
      frequency: r.frequency,
      status: r.status
    }

    if (r.type === 'grouped') {
      const idKey = `${dayKey}|G|${r.interventionId}|${r.subtitle || ''}|${
        r.coordinatorId || ''
      }`
      const existing = groupedIndex.get(idKey)
      if (existing) {
        existing.participants.push({
          id: r.participantId,
          name: r.beneficiaryName
        })
        existing.entries.push(r)
        existing.base.status = statusAggregate(existing.entries.map(e => e.status))
      } else {
        const item: GroupedCalendarItem = {
          kind: 'grouped',
          idKey,
          date: d,
          base: { ...base, status: statusAggregate([r.status]) },
          participants: [{ id: r.participantId, name: r.beneficiaryName }],
          entries: [r]
        }
        groupedIndex.set(idKey, item)
        push(dayKey, item)
      }
    } else {
      const idKey = `${dayKey}|S|${r.id}`
      const item: SingleCalendarItem = {
        kind: 'single',
        idKey,
        date: d,
        base,
        participant: { id: r.participantId, name: r.beneficiaryName },
        entry: r
      }
      push(dayKey, item)
    }
  }

  for (const [k, arr] of map) {
    arr.sort((a, b) => {
      const da = a.date.valueOf()
      const db = b.date.valueOf()
      if (da !== db) return da - db
      const la = (a as any).base?.interventionTitle || ''
      const lb = (b as any).base?.interventionTitle || ''
      return la.localeCompare(lb)
    })
    map.set(k, arr)
  }

  return map
}

export default function IndicativeCalendar () {
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  // Always implementation view
  const viewField: 'implementation' = 'implementation'

  // Pull companyCode from identity (handle a few possible shapes)
  const identity = (useFullIdentity?.() ?? {}) as any
  const companyCode: string | undefined =
    identity?.user?.companyCode ??
    identity?.companyCode ??
    identity?.profile?.companyCode

  const [panelMonth, setPanelMonth] = useState<Dayjs>(dayjs().startOf('month'))
  const [loading, setLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [entries, setEntries] = useState<IndicativeEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [programName, setProgramName] = useState<string>('Program')

  // NEW: export scope toggle
  const [exportScope, setExportScope] = useState<'month' | 'all'>('month')

  // Modal state
  const [open, setOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null)
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null)

  // Load program name by companyCode
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        if (!companyCode) return
        const snap = await getDocs(
          query(
            collection(db, 'programs'),
            where('companyCode', '==', companyCode),
            limit(1)
          )
        )
        const doc = snap.docs[0]
        const data = doc?.data() as any
        const name = data?.programName || data?.name || data?.title || 'Program'
        if (alive) setProgramName(String(name))
      } catch {
        /* keep default */
      }
    })()
    return () => {
      alive = false
    }
  }, [companyCode])

  /** Load ONLY from 'indicativeCalender' for the visible month */
  const loadMonth = useCallback(async () => {
    setLoading(true)
    setError(null)

    const start = panelMonth.startOf('month').startOf('day')
    const end = panelMonth.endOf('month').endOf('day')

    try {
      const startTs = Timestamp.fromDate(start.toDate())
      const endTs = Timestamp.fromDate(end.toDate())
      const baseRef = collection(db, 'indicativeCalender')

      const [snap1, snap2] = await Promise.all([
        getDocs(
          query(
            baseRef,
            where('targetDate', '>=', startTs),
            where('targetDate', '<=', endTs)
          )
        ),
        getDocs(
          query(
            baseRef,
            where('implementationDate', '>=', startTs),
            where('implementationDate', '<=', endTs)
          )
        )
      ])

      const rows: IndicativeEntry[] = []
      const pushDoc = (d: any) => {
        const data = d.data() as any
        rows.push({
          id: data?.id || d.id,
          participantId: data?.participantId,
          beneficiaryName: data?.beneficiaryName,
          interventionId: data?.interventionId,
          interventionTitle: data?.interventionTitle,
          areaOfSupport: data?.areaOfSupport,
          type: data?.type,
          targetDate: tsToDayjs(data?.targetDate),
          implementationDate: tsToDayjs(data?.implementationDate),
          isRecurring: !!data?.isRecurring,
          frequency: data?.frequency ?? null,
          subtitle: data?.subtitle ?? null,
          coordinatorId: data?.coordinatorId ?? null,
          coordinatorName: data?.coordinatorName ?? null,
          companyCode: data?.companyCode ?? null,
          status: data?.status ?? null
        })
      }
      snap1.forEach(pushDoc)
      snap2.forEach(pushDoc)

      // Dedup and filter by user's companyCode (if present)
      const dedup = new Map<string, IndicativeEntry>()
      rows.forEach(r => dedup.set(r.id, r))

      const filtered = [...dedup.values()].filter(r => {
        if (companyCode && r.companyCode !== companyCode) return false
        return true
      })

      setEntries(filtered)
    } catch (e: any) {
      console.error(e)
      setError(e?.message || 'Failed to load calendar data')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [panelMonth, companyCode])

  useEffect(() => {
    loadMonth()
  }, [loadMonth])

  /** Aggregate into calendar items (group grouped sessions) */
  const itemsByDate = useMemo(() => buildItemsByDate(entries), [entries])

  /** Flatten for export (Implementation view) — MONTH scope */
  const exportRowsMonth = useMemo(() => {
    const rows: {
      interventionTitle: string
      areaOfSupport: string
      participantsCount: number
      implementationDate: string
    }[] = []

    for (const arr of itemsByDate.values()) {
      for (const item of arr) {
        rows.push({
          interventionTitle: item.base.interventionTitle || 'Intervention',
          areaOfSupport: item.base.areaOfSupport || '—',
          participantsCount:
            item.kind === 'grouped' ? item.participants.length : 1,
          implementationDate: item.date.format('YYYY-MM-DD')
        })
      }
    }

    rows.sort((a, b) => {
      const d = a.implementationDate.localeCompare(b.implementationDate)
      if (d !== 0) return d
      return a.interventionTitle.localeCompare(b.interventionTitle)
    })

    return rows
  }, [itemsByDate])

  // HTML escaper for fallback
  function escapeHtml (s: string) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  /** Helper: fetch ALL entries (filtered by companyCode) and build export rows */
  const buildExportAll = useCallback(async () => {
    const snap = await getDocs(collection(db, 'indicativeCalender'))
    const all: IndicativeEntry[] = []
    snap.forEach(d => {
      const data = d.data() as any
      const row: IndicativeEntry = {
        id: data?.id || d.id,
        participantId: data?.participantId,
        beneficiaryName: data?.beneficiaryName,
        interventionId: data?.interventionId,
        interventionTitle: data?.interventionTitle,
        areaOfSupport: data?.areaOfSupport,
        type: data?.type,
        targetDate: tsToDayjs(data?.targetDate),
        implementationDate: tsToDayjs(data?.implementationDate),
        isRecurring: !!data?.isRecurring,
        frequency: data?.frequency ?? null,
        subtitle: data?.subtitle ?? null,
        coordinatorId: data?.coordinatorId ?? null,
        coordinatorName: data?.coordinatorName ?? null,
        companyCode: data?.companyCode ?? null,
        status: data?.status ?? null
      }
      if (!companyCode || row.companyCode === companyCode) {
        all.push(row)
      }
    })

    const itemsAll = buildItemsByDate(all)

    // Build export rows + compute min/max dates for header
    const rows: {
      interventionTitle: string
      areaOfSupport: string
      participantsCount: number
      implementationDate: string
    }[] = []
    let minDate: Dayjs | null = null
    let maxDate: Dayjs | null = null

    for (const arr of itemsAll.values()) {
      for (const item of arr) {
        rows.push({
          interventionTitle: item.base.interventionTitle || 'Intervention',
          areaOfSupport: item.base.areaOfSupport || '—',
          participantsCount:
            item.kind === 'grouped' ? item.participants.length : 1,
          implementationDate: item.date.format('YYYY-MM-DD')
        })
        if (!minDate || item.date.isBefore(minDate)) minDate = item.date
        if (!maxDate || item.date.isAfter(maxDate)) maxDate = item.date
      }
    }

    rows.sort((a, b) => {
      const d = a.implementationDate.localeCompare(b.implementationDate)
      if (d !== 0) return d
      return a.interventionTitle.localeCompare(b.interventionTitle)
    })

    return {
      rows,
      minDate: minDate?.format('YYYY-MM-DD') || '—',
      maxDate: maxDate?.format('YYYY-MM-DD') || '—'
    }
  }, [companyCode])

  /** Download PDF (scope-aware, landscape, auto-fit columns) */
  const downloadPdf: React.MouseEventHandler<HTMLElement> = async e => {
    e.preventDefault()
    e.stopPropagation()

    setPdfLoading(true)
    try {
      // Decide scope
      const dataForExport =
        exportScope === 'month'
          ? {
              rows: exportRowsMonth,
              minDate: panelMonth.startOf('month').format('YYYY-MM-DD'),
              maxDate: panelMonth.endOf('month').format('YYYY-MM-DD')
            }
          : await buildExportAll()

      if (!dataForExport.rows.length) {
        message.info(
          exportScope === 'month'
            ? 'No items to export for this month.'
            : 'No items to export.'
        )
        return
      }

      const titleLine = `${String(
        programName || 'Program'
      ).toUpperCase()} INDICATIVE CALENDAR`
      const dateLine = `${dataForExport.minDate} - ${dataForExport.maxDate}`

      // Try dynamic imports
      const jsPDFMod: any = await import('jspdf').catch(() => null)
      const autoTableMod: any = await import('jspdf-autotable').catch(
        () => null
      )
      const jsPDFCtor = jsPDFMod?.jsPDF || jsPDFMod?.default || jsPDFMod
      const autoTableFn = autoTableMod?.default || autoTableMod?.autoTable

      if (jsPDFCtor && autoTableFn) {
        const doc = new jsPDFCtor({
          orientation: 'landscape',
          unit: 'pt',
          format: 'a4'
        })
        const marginX = 36

        doc.setFontSize(18)
        doc.text(titleLine, marginX, 40)
        doc.setFontSize(11)
        doc.text(dateLine, marginX, 60)

        autoTableFn(doc, {
          startY: 78,
          head: [
            [
              'Intervention',
              'Area Of Support',
              'Number Of Participants',
              'Implementation Date'
            ]
          ],
          body: dataForExport.rows.map(r => [
            r.interventionTitle,
            r.areaOfSupport,
            String(r.participantsCount),
            r.implementationDate
          ]),
          styles: { fontSize: 10, cellPadding: 6, overflow: 'linebreak' },
          headStyles: {
            fillColor: [230, 242, 255],
            textColor: 40,
            fontStyle: 'bold'
          },
          columnStyles: {
            2: { halign: 'right' as const }
          },
          tableWidth: 'auto',
          theme: 'grid',
          margin: { left: marginX, right: marginX }
        })

        const suffix =
          exportScope === 'month'
            ? panelMonth.format('YYYYMM')
            : `${dataForExport.minDate.replace(/-/g, '')}-${dataForExport.maxDate.replace(
                /-/g,
                ''
              )}`

        const fname = `${(programName || 'program')
          .toLowerCase()
          .replace(/\s+/g, '-')}-indicative-${suffix}.pdf`
        doc.save(fname)
        return
      }

      // Fallback: print-friendly HTML
      const html = `
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${titleLine}</title>
            <style>
              body { font-family: Inter, Arial, sans-serif; padding: 24px; }
              h1 { font-size: 18px; margin: 0 0 6px 0; font-weight: 700; letter-spacing: 0.3px; }
              h2 { font-size: 12px; margin: 0 0 16px 0; color: #555; }
              table { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; }
              th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; word-wrap: break-word; }
              th { background: #e6f2ff; text-align: left; }
              th:nth-child(3), td:nth-child(3) { text-align: right; width: 16%; }
              th:nth-child(4), td:nth-child(4) { width: 18%; }
              @page { size: A4 landscape; margin: 16mm; }
            </style>
          </head>
          <body>
            <h1>${escapeHtml(titleLine)}</h1>
            <h2>${escapeHtml(dateLine)}</h2>
            <table>
              <thead>
                <tr>
                  <th>Intervention</th>
                  <th>Area Of Support</th>
                  <th>Number Of Participants</th>
                  <th>Implementation Date</th>
                </tr>
              </thead>
              <tbody>
                ${dataForExport.rows
                  .map(
                    r => `<tr>
                      <td>${escapeHtml(r.interventionTitle)}</td>
                      <td>${escapeHtml(r.areaOfSupport)}</td>
                      <td>${r.participantsCount}</td>
                      <td>${r.implementationDate}</td>
                    </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
            <script>window.onload = () => window.print();</script>
          </body>
        </html>
      `
      const w = window.open('about:blank', '_blank', 'noopener,noreferrer')
      if (w && w.document) {
        w.document.open()
        w.document.write(html)
        w.document.close()
      } else {
        message.warning(
          'Popup blocked. Allow popups or install jsPDF for direct download.'
        )
      }
    } catch (err) {
      console.error(err)
      message.error('Failed to generate PDF.')
    } finally {
      setPdfLoading(false)
    }
  }

  /** Date cell renderer */
  const dateCellRender = (value: Dayjs) => {
    const list = itemsByDate.get(value.format('YYYY-MM-DD')) || []
    if (!list.length) return null

    const max = 3
    const shown = list.slice(0, max)
    const more = list.length - shown.length

    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {shown.map(item => {
          const status =
            (item.base.status || 'planned') === 'confirmed'
              ? 'success'
              : (item.base.status || 'planned') === 'cancelled'
              ? 'error'
              : 'processing'
          const title =
            item.base.interventionTitle ||
            item.base.areaOfSupport ||
            'Intervention'
          const subtitle = item.base.subtitle ? ` — ${item.base.subtitle}` : ''
          const extra =
            item.kind === 'grouped' ? ` (${item.participants.length})` : ''
          return (
            <li key={item.idKey} style={{ marginBottom: 4, cursor: 'pointer' }}>
              <Tooltip title='View details'>
                <Badge
                  status={status as any}
                  text={
                    <span
                      onClick={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        setSelectedItem(item)
                        setSelectedDate(value)
                        setOpen(true)
                      }}
                    >
                      {title}
                      {subtitle}
                      {extra}
                    </span>
                  }
                />
              </Tooltip>
            </li>
          )
        })}
        {more > 0 && (
          <li>
            <Text
              type='secondary'
              style={{ cursor: 'pointer' }}
              onClick={e => {
                e.preventDefault()
                e.stopPropagation()
                setSelectedItem(null)
                setSelectedDate(value)
                setOpen(true)
              }}
            >
              +{more} more
            </Text>
          </li>
        )}
      </ul>
    )
  }

  const startOfMonth = panelMonth.startOf('month')
  const endOfMonth = panelMonth.endOf('month')

  return (
    <Card
      title={
        <Space>
          <CalendarOutlined />
          <span>{programName || 'Indicative Calendar'}</span>
          <Tag color='geekblue'>Implementation dates</Tag>
        </Space>
      }
      extra={
        <Space wrap>
          {/* NEW: export scope toggle */}
          <Segmented
            options={[
              { label: 'This Month', value: 'month' },
              { label: 'All Dates', value: 'all' }
            ]}
            value={exportScope}
            onChange={val => setExportScope(val as 'month' | 'all')}
          />
          <Button
            icon={<FilePdfOutlined />}
            onClick={downloadPdf}
            htmlType='button'
            loading={pdfLoading}
          >
            Download PDF
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={e => {
              e.preventDefault()
              loadMonth()
            }}
            htmlType='button'
            loading={loading}
          >
            Reload
          </Button>
        </Space>
      }
      bodyStyle={{ padding: isMobile ? 8 : 16 }}
      style={{ borderRadius: 8, minHeight: '100vh' }}
    >
      <div style={{ minHeight: 360 }}>
        {error ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space>
                <InfoCircleOutlined />
                <span>{error}</span>
              </Space>
            }
          />
        ) : (
          <>
            {loading && (
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <Spin />
              </div>
            )}
            <Calendar
              fullscreen={!isMobile}
              value={panelMonth}
              onPanelChange={val => setPanelMonth(val.startOf('month'))}
              onSelect={val => {
                setSelectedDate(val)
                setSelectedItem(null)
                setOpen(true)
              }}
              dateCellRender={dateCellRender}
            />
          </>
        )}
      </div>

      {/* Details Modal (read-only) */}
      <Modal
        open={open}
        title={
          <Space>
            <CalendarOutlined />
            <span>
              {selectedDate
                ? `${selectedDate.format('YYYY-MM-DD')} • Implementation`
                : 'Details'}
            </span>
          </Space>
        }
        onCancel={() => {
          setOpen(false)
          setSelectedItem(null)
        }}
        footer={null}
        width={isMobile ? 560 : 780}
      >
        {selectedDate ? (
          (() => {
            const dayKey = selectedDate.format('YYYY-MM-DD')
            const items = itemsByDate.get(dayKey) || []
            if (!items.length)
              return <Empty description='No items for this day' />

            if (selectedItem) {
              const base = selectedItem.base
              const title = base.interventionTitle || 'Intervention'
              const implementationDate =
                selectedItem.kind === 'single'
                  ? selectedItem.entry.implementationDate
                  : selectedItem.entries[0]?.implementationDate
              const targetDate =
                selectedItem.kind === 'single'
                  ? selectedItem.entry.targetDate
                  : selectedItem.entries[0]?.targetDate

              return (
                <>
                  <Title level={5} style={{ marginTop: 0 }}>
                    {title}
                  </Title>
                  <Space wrap>
                    {base.subtitle && <Tag color='blue'>{base.subtitle}</Tag>}
                    {base.isRecurring && (
                      <Tag>
                        Recurring{base.frequency ? ` • ${base.frequency}` : ''}
                      </Tag>
                    )}
                    {base.coordinatorName && <Tag>{base.coordinatorName}</Tag>}
                    <Tag
                      color={
                        (base.status || 'planned') === 'confirmed'
                          ? 'green'
                          : (base.status || 'planned') === 'cancelled'
                          ? 'red'
                          : 'blue'
                      }
                    >
                      {base.status || 'planned'}
                    </Tag>
                  </Space>
                  <Divider />
                  <Descriptions
                    size={isMobile ? 'small' : 'middle'}
                    column={isMobile ? 1 : 2}
                    bordered
                  >
                    <Descriptions.Item label='Type'>
                      {selectedItem.kind === 'grouped' ? 'grouped' : 'singular'}
                    </Descriptions.Item>
                    <Descriptions.Item label='Coordinator'>
                      {base.coordinatorName || base.coordinatorId || '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label='Implementation Date'>
                      {implementationDate?.format('YYYY-MM-DD') || '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label='Due Date'>
                      {targetDate?.format('YYYY-MM-DD') || '—'}
                    </Descriptions.Item>
                  </Descriptions>

                  {selectedItem.kind === 'grouped' ? (
                    <>
                      <Divider />
                      <Title level={5} style={{ marginTop: 0 }}>
                        Participants ({selectedItem.participants.length})
                      </Title>
                      <List
                        size='small'
                        dataSource={selectedItem.participants}
                        renderItem={p => (
                          <List.Item>{p.name || p.id}</List.Item>
                        )}
                        locale={{ emptyText: 'No participants' }}
                      />
                    </>
                  ) : (
                    <>
                      <Divider />
                      <Title level={5} style={{ marginTop: 0 }}>
                        Participant
                      </Title>
                      <Text>
                        {selectedItem.participant.name ||
                          selectedItem.participant.id}
                      </Text>
                    </>
                  )}
                </>
              )
            }

            return (
              <Space
                direction='vertical'
                style={{ width: '100%' }}
                size='large'
              >
                {items.map(item => {
                  const status =
                    (item.base.status || 'planned') === 'confirmed'
                      ? 'success'
                      : (item.base.status || 'planned') === 'cancelled'
                      ? 'error'
                      : 'processing'
                  const title =
                    item.base.interventionTitle ||
                    item.base.areaOfSupport ||
                    'Intervention'
                  const subtitle = item.base.subtitle
                    ? ` — ${item.base.subtitle}`
                    : ''
                  const right =
                    item.kind === 'grouped'
                      ? `${item.participants.length} participant${
                          item.participants.length > 1 ? 's' : ''
                        }`
                      : item.participant.name || item.participant.id

                  return (
                    <Card
                      key={item.idKey}
                      size='small'
                      style={{ borderRadius: 8 }}
                      onClick={() => setSelectedItem(item)}
                      hoverable
                    >
                      <Space direction='vertical' style={{ width: '100%' }}>
                        <Space wrap>
                          <Badge
                            status={status as any}
                            text={<strong>{title}</strong>}
                          />
                          {item.base.subtitle && (
                            <Text type='secondary'>• {item.base.subtitle}</Text>
                          )}
                        </Space>
                        <Space wrap>
                          <Text>
                            <b>
                              {item.kind === 'grouped'
                                ? 'Participants'
                                : 'Participant'}
                              :
                            </b>{' '}
                            {right}
                          </Text>
                          <Text type='secondary'>|</Text>
                          <Text>
                            <b>Coordinator:</b>{' '}
                            {item.base.coordinatorName ||
                              item.base.coordinatorId ||
                              '—'}
                          </Text>
                        </Space>
                      </Space>
                    </Card>
                  )
                })}
              </Space>
            )
          })()
        ) : (
          <Empty />
        )}
      </Modal>
    </Card>
  )
}
