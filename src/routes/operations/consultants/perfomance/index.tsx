import React, { useEffect, useMemo, useState } from 'react'
import {
  Card,
  Row,
  Col,
  Typography,
  Button,
  DatePicker,
  Space,
  Table,
  Tag,
  Progress,
  Statistic,
  Tooltip,
  Empty,
  Modal,
  Grid,
  List
} from 'antd'
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  StarFilled,
  ProfileOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  DashboardOutlined,
  FullscreenOutlined
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import dayjs, { Dayjs } from 'dayjs'
import { motion, AnimatePresence } from 'framer-motion'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { MotionCard } from '@/components/shared/Header'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

// ------- Shared card style -------
const cardStyle: React.CSSProperties = {
  boxShadow: '0 12px 32px rgba(0,0,0,0.10)',
  transition: 'all 0.3s ease',
  borderRadius: 14,
  border: '1px solid #e6efff',
  backdropFilter: 'blur(3px)'
}

// -------- Types --------
interface AssignedIntervention {
  id: string
  consultantId: string
  consultantName?: string
  participantId?: string
  beneficiaryName?: string
  interventionId?: string
  interventionTitle?: string
  status?: string // overall status
  userStatus?: string
  consultantStatus?: string
  userCompletionStatus?: string
  consultantCompletionStatus?: string
  targetMetric?: string
  targetType?: string
  targetValue?: number
  type?: string
  progress?: number // 0-100
  timeSpent?: number // minutes
  dueDate?: any
  createdAt?: any
  updatedAt?: any
  feedback?: any // { rating?: number }
  companyCode?: string
  flaggedForReview?: boolean
}

// ------- Status helpers -------
const normalizeStatus = (s?: string) => {
  const v = (s || '').trim().toLowerCase().replace(/\s|_/g, '-')
  if (['in-progress', 'inprogress', 'ongoing'].includes(v)) return 'In-Progress'
  if (['completed', 'done', 'complete'].includes(v)) return 'Completed'
  if (['assigned', 'new'].includes(v)) return 'Assigned'
  if (['overdue', 'late', 'past-due'].includes(v)) return 'Overdue'
  return (s && s[0]?.toUpperCase() + s.slice(1)) || '—'
}
const statusColor = (n: string) =>
  n === 'Completed'
    ? 'green'
    : n === 'In-Progress'
    ? 'blue'
    : n === 'Overdue'
    ? 'red'
    : n === 'Assigned'
    ? 'gold'
    : 'default'

const ConsultantPerformance: React.FC = () => {
  const navigate = useNavigate()
  const { id: consultantId } = useParams<{ id: string }>()
  const { user } = useFullIdentity()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<AssignedIntervention[]>([])
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [consultantName, setConsultantName] = useState<string>('')
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  const [donutStatus, setDonutStatus] = useState<string | null>(null)

  // modal state for chart expansion
  const [expanded, setExpanded] = useState<null | 'status' | 'monthly'>(null)

  const fetchData = async () => {
    if (!user?.companyCode || !consultantId) return
    setLoading(true)
    try {
      const base: any[] = [where('consultantId', '==', consultantId)]
      const snap = await getDocs(
        query(collection(db, 'assignedInterventions'), ...base)
      )
      console.log('Loading Data', consultantId)
      const data = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as any)
      })) as AssignedIntervention[]
      const effective = data
      setRows(effective)

      // consultant name
      const fromRow = effective.find(r => r.consultantName)?.consultantName
      if (fromRow) {
        setConsultantName(fromRow)
      } else {
        const c = await getDoc(doc(db, 'consultants', consultantId))
        if (c.exists())
          setConsultantName((c.data() as any).name || consultantId)
        else setConsultantName(consultantId)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.companyCode, consultantId])

  // -------- Range filter (no dayjs plugins; numeric compare) --------
  const filtered = useMemo(() => {
    if (!range) return rows
    const [from, to] = range
    const start = from.startOf('day').valueOf()
    const end = to.endOf('day').valueOf()
    return rows.filter(r => {
      const dt =
        r.createdAt?.toDate?.() ??
        r.createdAt ??
        r.updatedAt?.toDate?.() ??
        r.updatedAt ??
        r.dueDate?.toDate?.() ??
        r.dueDate
      if (!dt) return false
      const t = dayjs(dt).valueOf()
      return t >= start && t <= end
    })
  }, [rows, range])

  const rowMatchesDonut = (r: AssignedIntervention, status: string) => {
    const n = normalizeStatus(r.status || r.consultantStatus || r.userStatus)
    const done =
      normalizeStatus(
        r.status || r.consultantCompletionStatus || r.userCompletionStatus
      ) === 'Completed' || r.progress === 100

    const due = r.dueDate?.toDate?.() ?? r.dueDate
    const overdue = due ? dayjs(due).isBefore(dayjs(), 'day') && !done : false

    if (status === 'Completed') return done
    if (status === 'In-Progress')
      return (
        n === 'In-Progress' ||
        ((r.progress || 0) > 0 && (r.progress || 0) < 100)
      )
    if (status === 'Overdue') return overdue
    if (status === 'Pending')
      return !done && !(r.progress || 0) && !overdue && n !== 'In-Progress'
    return true
  }

  const tableRows = useMemo(
    () =>
      donutStatus
        ? filtered.filter(r => rowMatchesDonut(r, donutStatus))
        : filtered,
    [filtered, donutStatus]
  )

  const tableAnimKey = `rows-${donutStatus || 'all'}-${filtered.length}`

  // ===== KPIs =====
  const totalAssigned = filtered.length
  const completedCount = filtered.filter(
    r =>
      normalizeStatus(
        r.status || r.consultantCompletionStatus || r.userCompletionStatus
      ) === 'Completed' || r.progress === 100
  ).length

  const inProgressCount = filtered.filter(
    r =>
      normalizeStatus(r.status || r.consultantStatus || r.userStatus) ===
        'In-Progress' ||
      ((r.progress || 0) > 0 && (r.progress || 0) < 100)
  ).length

  const overdueCount = filtered.filter(r => {
    const due = r.dueDate?.toDate?.() ?? r.dueDate
    const done =
      normalizeStatus(
        r.status || r.consultantCompletionStatus || r.userCompletionStatus
      ) === 'Completed' || r.progress === 100
    return due ? dayjs(due).isBefore(dayjs(), 'day') && !done : false
  }).length

  const completionRate = totalAssigned
    ? Math.round((completedCount / totalAssigned) * 100)
    : 0
  const avgProgress = totalAssigned
    ? Math.round(
        filtered.reduce((a, r) => a + (r.progress || 0), 0) / totalAssigned
      )
    : 0

  // Rating (avg of feedback.rating if present)
  const avgRating: number | null = useMemo(() => {
    const ratings = filtered
      .map(r => r.feedback?.rating)
      .filter((x: any) => typeof x === 'number') as number[]
    if (!ratings.length) return null
    return +(ratings.reduce((a, v) => a + v, 0) / ratings.length).toFixed(2)
  }, [filtered])

  // ===== Charts =====
  const statusBreakdown = useMemo(
    () => ({
      completed: completedCount,
      inProgress: inProgressCount,
      overdue: overdueCount,
      pending: Math.max(
        totalAssigned - completedCount - inProgressCount - overdueCount,
        0
      )
    }),
    [completedCount, inProgressCount, overdueCount, totalAssigned]
  )

  const donutSeries = useMemo(
    () =>
      [
        { name: 'Completed', y: statusBreakdown.completed, color: '#52c41a' },
        {
          name: 'In-Progress',
          y: statusBreakdown.inProgress,
          color: '#1677ff'
        },
        { name: 'Overdue', y: statusBreakdown.overdue, color: '#ff4d4f' },
        { name: 'Pending', y: statusBreakdown.pending, color: '#faad14' }
      ].map(pt => ({
        ...pt,
        sliced: donutStatus === pt.name,
        selected: donutStatus === pt.name
      })),
    [statusBreakdown, donutStatus]
  )
  // Monthly assigned vs completed
  const monthlySeries = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) =>
      dayjs()
        .startOf('month')
        .subtract(5 - i, 'month')
    )
    const labels = months.map(m => m.format('MMM YYYY'))
    const assignedCounts = months.map(
      m =>
        filtered.filter(r =>
          dayjs(
            r.createdAt?.toDate?.() ??
              r.createdAt ??
              r.updatedAt?.toDate?.() ??
              r.updatedAt ??
              new Date()
          ).isSame(m, 'month')
        ).length
    )
    const completedCounts = months.map(
      m =>
        filtered.filter(r => {
          const done =
            normalizeStatus(
              r.status || r.consultantCompletionStatus || r.userCompletionStatus
            ) === 'Completed' || r.progress === 100
          const dt =
            r.updatedAt?.toDate?.() ??
            r.updatedAt ??
            r.dueDate?.toDate?.() ??
            r.dueDate
          return done && (dt ? dayjs(dt).isSame(m, 'month') : false)
        }).length
    )
    return { labels, assignedCounts, completedCounts }
  }, [filtered])

  const isEmptyPie = donutSeries.every(pt => (pt.y ?? 0) === 0)

  const isMonthlyEmpty =
    monthlySeries.assignedCounts.every(v => v === 0) &&
    monthlySeries.completedCounts.every(v => v === 0)

  const statusDonut: Highcharts.Options = {
    chart: {
      type: 'pie',
      backgroundColor: 'transparent',
      height: isMobile ? 240 : 300
    },
    title: { text: undefined },
    credits: { enabled: false },
    exporting: { enabled: false },
    legend: {
      enabled: true,
      align: 'center',
      verticalAlign: 'bottom',
      itemStyle: { fontSize: isMobile ? '11px' : '12px' }
    },
    tooltip: {
      pointFormat: '<b>{point.y}</b> assignments ({point.percentage:.1f}%)'
    },
    plotOptions: {
      pie: {
        innerSize: '60%',
        showInLegend: true,
        allowPointSelect: true,
        cursor: 'pointer',
        dataLabels: { enabled: false },
        point: {
          events: {
            click: function () {
              const name = (this as any).name as string
              setDonutStatus(prev => (prev === name ? null : name))
            },
            legendItemClick: function () {
              const name = (this as any).name as string
              setDonutStatus(prev => (prev === name ? null : name))
              return false
            }
          }
        }
      }
    },
    series: [{ type: 'pie', name: 'Assignments', data: donutSeries }]
  }

  const assignedVsCompleted: Highcharts.Options = {
    chart: {
      type: 'column',
      backgroundColor: 'transparent',
      height: isMobile ? 240 : 300
    },
    title: { text: undefined },
    credits: { enabled: false },
    exporting: { enabled: false },
    xAxis: {
      categories: monthlySeries.labels,
      lineColor: '#e5e7eb',
      labels: { style: { fontSize: isMobile ? '11px' : '12px' } }
    },
    yAxis: {
      title: { text: 'Count' },
      gridLineColor: '#f1f5f9',
      allowDecimals: false,
      labels: { style: { fontSize: isMobile ? '11px' : '12px' } }
    },
    tooltip: { shared: true },
    plotOptions: {
      column: { borderRadius: 4, dataLabels: { enabled: !isMobile } }
    },
    series: [
      {
        type: 'column',
        name: 'Assigned',
        data: monthlySeries.assignedCounts,
        color: '#1677ff'
      },
      {
        type: 'column',
        name: 'Completed',
        data: monthlySeries.completedCounts,
        color: '#52c41a'
      }
    ]
  }

  // Expanded-chart options (bigger height)
  const expandedOptions = (opts: Highcharts.Options): Highcharts.Options => ({
    ...opts,
    chart: { ...(opts.chart || {}), height: 520 }
  })

  // ===== Table =====
  const columns = [
    {
      title: 'Beneficiary',
      dataIndex: 'beneficiaryName',
      key: 'beneficiaryName'
    },
    {
      title: 'Intervention',
      dataIndex: 'interventionTitle',
      key: 'interventionTitle'
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, r: AssignedIntervention) => {
        const n = normalizeStatus(
          r.status || r.userStatus || r.consultantStatus
        )
        return <Tag color={statusColor(n)}>{n}</Tag>
      }
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (d: any, r: AssignedIntervention) => {
        const dt = d?.toDate?.() ?? d
        const overdue = dt
          ? dayjs(dt).isBefore(dayjs(), 'day') &&
            (r.progress || 0) < 100 &&
            normalizeStatus(r.status) !== 'Completed'
          : false
        return (
          <span style={{ color: overdue ? '#ff4d4f' : undefined }}>
            {dt ? dayjs(dt).format('MMM D, YYYY') : '—'}
            {overdue ? ' • Overdue' : ''}
          </span>
        )
      }
    },
    {
      title: 'Progress',
      dataIndex: 'progress',
      key: 'progress',
      render: (p: number = 0) => (
        <div style={{ minWidth: 220 }}>
          <Progress percent={Math.max(0, Math.min(100, p || 0))} />
        </div>
      )
    },
    {
      title: 'Time Spent',
      dataIndex: 'timeSpent',
      key: 'timeSpent',
      render: (m?: number) => (typeof m === 'number' ? `${m}h` : '—')
    },
    {
      title: 'Flags',
      key: 'flags',
      render: (_: any, r: AssignedIntervention) =>
        r.flaggedForReview ? <Tag color='red'>Review</Tag> : null
    }
  ]

  // ===== Render =====
  return (
    <div style={{ padding: 8, minHeight: '100vh' }}>
      {/* Header */}
      <MotionCard
        style={{ background: 'linear-gradient(90deg,#eef4ff,#f9fbff)' }}
      >
        <Row align='middle' justify='space-between'>
          <Col>
            <Space>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/operations/consultants')}
              >
                Back
              </Button>
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  Consultant Performance
                </Title>
                <Text type='secondary'>{consultantName || consultantId}</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <RangePicker
                allowEmpty={[false, false]}
                value={range as any}
                onChange={v => setRange(v as any)}
                placeholder={['From', 'To']}
              />
              <Tooltip title='Refresh'>
                <Button icon={<ReloadOutlined />} onClick={fetchData} />
              </Tooltip>
            </Space>
          </Col>
        </Row>
      </MotionCard>

      {/* KPIs */}
      <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
        <Col xs={24} sm={12} md={6}>
          <MotionCard style={{ padding: '16px 20px' }}>
            <Statistic
              title='Assigned'
              value={totalAssigned}
              prefix={<ProfileOutlined />}
            />
          </MotionCard>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <MotionCard style={{ padding: '16px 20px' }}>
            <Statistic
              title='Completed'
              value={completedCount}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </MotionCard>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <MotionCard style={{ padding: '16px 20px' }}>
            <Statistic
              title='Completion Rate'
              value={`${completionRate}%`}
              prefix={<RiseOutlined />}
            />
          </MotionCard>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <MotionCard style={{ padding: '16px 20px' }}>
            <Statistic
              title='Avg Progress'
              value={`${avgProgress}%`}
              prefix={<DashboardOutlined />}
            />
          </MotionCard>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={16} style={{ marginTop: 12 }}>
        <Col xs={24} md={12}>
          <MotionCard
            title='Assignments by Status'
            extra={
              <Space>
                <Button
                  size='small'
                  disabled={!donutStatus}
                  onClick={() => setDonutStatus(null)}
                >
                  Clear
                </Button>
                <Button
                  type='text'
                  icon={<FullscreenOutlined />}
                  onClick={() => setExpanded('status')}
                >
                  Expand
                </Button>
              </Space>
            }
          >
            {loading ? (
              <Empty description='Loading…' />
            ) : isEmptyPie ? (
              <Empty description='No status data' />
            ) : (
              <HighchartsReact highcharts={Highcharts} options={statusDonut} />
            )}
          </MotionCard>
        </Col>

        <Col xs={24} md={12}>
          <MotionCard
            title='Assigned vs Completed (Monthly)'
            extra={
              <Button
                type='text'
                icon={<FullscreenOutlined />}
                onClick={() => setExpanded('monthly')}
              >
                Expand
              </Button>
            }
          >
            {loading ? (
              <Empty description='Loading…' />
            ) : isMonthlyEmpty ? (
              <Empty description='No monthly activity' />
            ) : (
              <>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={assignedVsCompleted}
                />
                {avgRating != null && (
                  <div
                    style={{
                      marginTop: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <StarFilled style={{ color: '#faad14' }} />
                    <Text strong>Avg Rating:</Text> <Text>{avgRating} / 5</Text>
                  </div>
                )}
              </>
            )}
          </MotionCard>
        </Col>
      </Row>

      {/* Table */}
      <Row style={{ marginTop: 16 }}>
        <Col span={24}>
          <MotionCard title='Current Interventions'>
            <AnimatePresence mode='wait'>
              <motion.div
                key={tableAnimKey}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                {isMobile ? (
                  <>
                    <List
                      loading={loading}
                      dataSource={tableRows}
                      pagination={{ pageSize: 8 }}
                      renderItem={r => {
                        const n = normalizeStatus(
                          r.status || r.userStatus || r.consultantStatus
                        )
                        const dt = r.dueDate?.toDate?.() ?? r.dueDate
                        const overdue = dt
                          ? dayjs(dt).isBefore(dayjs(), 'day') &&
                            (r.progress || 0) < 100 &&
                            normalizeStatus(r.status) !== 'Completed'
                          : false
                        return (
                          <List.Item key={r.id}>
                            <div style={{ width: '100%' }}>
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  gap: 8
                                }}
                              >
                                <div style={{ fontWeight: 600 }}>
                                  {r.interventionTitle || '—'}
                                </div>
                                <Tag color={statusColor(n)}>{n}</Tag>
                              </div>
                              <div style={{ color: '#6b7280' }}>
                                {r.beneficiaryName || '—'}
                              </div>
                              <div style={{ marginTop: 8 }}>
                                <Progress
                                  percent={Math.max(
                                    0,
                                    Math.min(100, r.progress || 0)
                                  )}
                                />
                              </div>
                              <div style={{ marginTop: 6, fontSize: 12 }}>
                                Due:{' '}
                                <span
                                  style={{
                                    color: overdue ? '#ff4d4f' : undefined
                                  }}
                                >
                                  {dt ? dayjs(dt).format('MMM D, YYYY') : '—'}
                                  {overdue ? ' • Overdue' : ''}
                                </span>
                                {typeof r.timeSpent === 'number' && (
                                  <span style={{ marginLeft: 12 }}>
                                    • Time:{' '}
                                    {`${Math.round(r.timeSpent / 60)}h ${
                                      r.timeSpent % 60 | 0
                                    }m`}
                                  </span>
                                )}
                                {r.flaggedForReview && (
                                  <Tag color='red' style={{ marginLeft: 12 }}>
                                    Review
                                  </Tag>
                                )}
                              </div>
                            </div>
                          </List.Item>
                        )
                      }}
                    />
                    {!loading && tableRows.length === 0 && (
                      <Empty style={{ marginTop: 12 }} />
                    )}
                  </>
                ) : (
                  <>
                    <Table
                      columns={columns as any}
                      dataSource={tableRows}
                      rowKey='id'
                      pagination={{ pageSize: 8 }}
                      size='small'
                      loading={loading}
                    />
                    {!loading && tableRows.length === 0 && (
                      <Empty style={{ marginTop: 12 }} />
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </MotionCard>
        </Col>
      </Row>

      {/* Expanded chart modal */}
      <Modal
        open={!!expanded}
        onCancel={() => setExpanded(null)}
        footer={null}
        width={1000}
        title={
          expanded === 'status'
            ? 'Assignments by Status'
            : 'Assigned vs Completed (Monthly)'
        }
        destroyOnClose
      >
        {expanded === 'status' && (
          <HighchartsReact
            highcharts={Highcharts}
            options={expandedOptions(statusDonut)}
          />
        )}
        {expanded === 'monthly' && (
          <HighchartsReact
            highcharts={Highcharts}
            options={expandedOptions(assignedVsCompleted)}
          />
        )}
      </Modal>
    </div>
  )
}

export default ConsultantPerformance
