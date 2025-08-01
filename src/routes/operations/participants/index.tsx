import React, { useEffect, useState } from 'react'
import {
  Card,
  Row,
  Col,
  Table,
  Statistic,
  Tag,
  Button,
  Progress,
  Select,
  Form,
  Input,
  Rate,
  message
} from 'antd'
import {
  TeamOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { db } from '@/firebase'
import { Helmet } from 'react-helmet'
import { addDoc, collection, doc, getDocs, updateDoc } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'

const { Option } = Select

const calculateProgress = (required: number, completed: number) => {
  if (!required || required === 0) return 0
  return Math.round((completed / required) * 100)
}

const OperationsParticipantsManagement: React.FC = () => {
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const [participants, setParticipants] = useState<any[]>([])
  const [metrics, setMetrics] = useState({
    totalParticipants: 0,
    totalRequiredInterventions: 0,
    totalCompletedInterventions: 0,
    totalNeedingAssignment: 0
  })
  const [loading, setLoading] = useState(true)
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([])
  const [filteredParticipants, setFilteredParticipants] = useState<any[]>([])
  const [searchText, setSearchText] = useState('')
  const [selectedProgram, setSelectedProgram] = useState('all')
  const { user } = useFullIdentity()
  const [departments, setDepartments] = useState<any[]>([])
  const [userDepartment, setUserDepartment] = useState<any>(null)

  const applyFilters = () => {
    // LOG: Filters being applied
    console.log('[applyFilters] Running filters', {
      selectedProgram,
      searchText,
      participantsCount: participants.length
    })
    let filtered = participants

    if (selectedProgram !== 'all') {
      filtered = filtered.filter(p => p.programId === selectedProgram)
    }

    if (searchText.trim()) {
      filtered = filtered.filter(
        p =>
          (p.beneficiaryName || '')
            .toLowerCase()
            .includes(searchText.toLowerCase()) ||
          (p.sector || '').toLowerCase().includes(searchText.toLowerCase())
      )
    }

    setFilteredParticipants(filtered)
    // LOG: Filtered results count
    console.log('[applyFilters] Filtered participants count:', filtered.length)
  }

  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        // LOG: Fetching programs...
        console.log('[fetchPrograms] Fetching programs...')
        const snapshot = await getDocs(collection(db, 'programs'))
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().programName || doc.data().name || doc.id
        }))
        setPrograms(list)
        // LOG: Programs loaded
        console.log('[fetchPrograms] Programs loaded:', list)
      } catch (error) {
        console.error('[fetchPrograms] Error loading programs:', error)
      }
    }
    fetchPrograms()
  }, [])

  useEffect(() => {
    // LOG: Calculating metrics...
    setMetrics({
      totalParticipants: participants.length,
      totalRequiredInterventions: participants.reduce(
        (a, p) => a + (p.interventions?.required?.length || 0),
        0
      ),
      totalCompletedInterventions: participants.reduce(
        (a, p) => a + (p.interventions?.completed?.length || 0),
        0
      ),
      totalNeedingAssignment: participants.filter(
        p => (p.interventions?.assigned?.length || 0) === 0
      ).length
    })
    console.log('[metrics] Updated:', {
      totalParticipants: participants.length,
      totalRequiredInterventions: participants.reduce(
        (a, p) => a + (p.interventions?.required?.length || 0),
        0
      ),
      totalCompletedInterventions: participants.reduce(
        (a, p) => a + (p.interventions?.completed?.length || 0),
        0
      ),
      totalNeedingAssignment: participants.filter(
        p => (p.interventions?.assigned?.length || 0) === 0
      ).length
    })
  }, [participants])

  // 1. Fetch departments and set userDepartment after user loads
  useEffect(() => {
    const fetchDepartments = async () => {
      if (user?.companyCode) {
        // LOG: Fetching departments
        console.log(
          '[fetchDepartments] Fetching departments for companyCode:',
          user.companyCode
        )
        const snapshot = await getDocs(collection(db, 'departments'))
        const all = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
        setDepartments(all)
        // LOG: Departments fetched
        console.log('[fetchDepartments] Departments:', all)
        // Always set a department object, even for main
        if (user.departmentId) {
          setUserDepartment(
            all.find(dep => dep.id === user.departmentId) || null
          )
        } else {
          // If user is 'main', find main department for this company
          setUserDepartment(all.find(dep => dep.isMain) || null)
        }
      } else {
        // LOG: user.companyCode not found yet
        console.log('[fetchDepartments] No companyCode yet...')
      }
    }
    fetchDepartments()
  }, [user])

  useEffect(() => {
    // LOG: User department changed or loaded
    console.log('[useEffect-participants] userDepartment:', userDepartment)
    if (userDepartment === undefined) return // Still loading
    if (!user?.companyCode) {
      console.warn('[fetchParticipants] No user/companyCode available')
      setParticipants([])
      setLoading(false)
      return
    }
    setLoading(true)
    const fetchParticipants = async () => {
      try {
        // LOG: Fetching participants and applications...
        console.log('[fetchParticipants] Fetching applications...')
        const applicationSnap = await getDocs(collection(db, 'applications'))
        console.log(
          '[fetchParticipants] Applications loaded:',
          applicationSnap.docs.length
        )
        const participantSnap = await getDocs(collection(db, 'participants'))
        console.log(
          '[fetchParticipants] Participants loaded:',
          participantSnap.docs.length
        )
        const participantMap = new Map(
          participantSnap.docs.map(doc => [doc.id, doc.data()])
        )

        // Map over applications (not participants) - programId is on app
        let participantsList = applicationSnap.docs
          .filter(
            doc =>
              (doc.data().applicationStatus || '').toLowerCase() === 'accepted'
          )
          .map(doc => {
            const app = doc.data()
            const participantId = app.participantId
            const participant = participantMap.get(participantId) || {}
            const interventions = app.interventions || {}
            const required = interventions.required || []
            const completed = interventions.completed || []
            const assigned = interventions.assigned || []
            const progress = calculateProgress(
              required.length,
              completed.length
            )
            return {
              id: participantId,
              ...participant,
              programId: app.programId || '',
              companyCode: app.companyCode || '', // <-- ADD THIS LINE!
              incubatorCode: app.incubatorCode || '', // <-- (if you use it)
              interventions: {
                required,
                completed,
                assigned,
                participationRate: interventions.participationRate || 0
              },
              assignedCount: assigned.length,
              completedCount: completed.length,
              progress,
              stage: app.stage || participant.stage || 'N/A'
            }
          })

        // If userDepartment is set & NOT main, filter by department
        if (userDepartment && !userDepartment.isMain) {
          participantsList = participantsList.filter(p =>
            (p.interventions?.required || []).some(
              i => i.departmentId === userDepartment.id
            )
          )
          console.log(
            '[fetchParticipants] Filtered by department:',
            userDepartment.id
          )
        } else {
          // No department found: show all for company
          console.log(
            '[fetchParticipants] No userDepartment or isMain; showing all for company:',
            user.companyCode
          )
          // If you want to filter by companyCode (recommended), do it here:
          participantsList = participantsList.filter(
            p =>
              p.companyCode === user.companyCode ||
              p.incubatorCode === user.companyCode // Support both field names
          )
        }
        // LOG: Final filtered participant count
        console.log(
          '[fetchParticipants] Final filtered participant count:',
          participantsList.length
        )
        setParticipants(participantsList)
      } catch (error) {
        console.error('[fetchParticipants] Error fetching participants:', error)
        setParticipants([])
      } finally {
        setLoading(false)
        // LOG: Loading set to false (should see this)
        console.log('[fetchParticipants] Loading set to false')
      }
    }
    fetchParticipants()
  }, [userDepartment, user])

  // Now run applyFilters ONLY when relevant values change:
  useEffect(() => {
    applyFilters()
  }, [participants, selectedProgram, searchText])

  const handleAddParticipant = async (values: any) => {
    try {
      const newParticipant = {
        beneficiaryName: values.beneficiaryName,
        sector: values.sector,
        stage: values.stage,
        developmentType: values.developmentType,
        gender: values.gender,
        ageGroup: values.ageGroup,
        incubatorCode: values.incubatorCode,
        email: values.email || '',
        interventions: {
          required: [],
          assigned: [],
          completed: [],
          participationRate: values.participationRate ?? 0
        },
        revenueHistory: {
          monthly: {},
          yearly: {}
        },
        headcountHistory: {
          monthly: {},
          yearly: {}
        }
      }
      // LOG: Adding new participant
      console.log(
        '[handleAddParticipant] Adding new participant:',
        newParticipant
      )
      await addDoc(collection(db, 'participants'), newParticipant)

      message.success('Participant added successfully!')
      setModalOpen(false)
      form.resetFields()

      // Refresh participants
      const snapshot = await getDocs(collection(db, 'participants'))
      const participantsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setParticipants(participantsList)
      // LOG: Refreshed participants after add
      console.log(
        '[handleAddParticipant] Participants after add:',
        participantsList.length
      )
    } catch (error) {
      console.error('[handleAddParticipant] Error adding participant:', error)
      message.error('Failed to add participant.')
    }
  }

  const columns = [
    {
      title: 'Beneficiary Name',
      dataIndex: 'beneficiaryName', // using beneficiaryName now
      key: 'beneficiaryName'
    },
    {
      title: 'Sector',
      dataIndex: 'sector',
      key: 'sector'
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage'
    },
    {
      title: 'Required',
      key: 'required',
      render: (record: any) => record.interventions?.required?.length ?? 0
    },
    {
      title: 'Completed',
      key: 'completed',
      render: (record: any) => record.interventions?.completed?.length ?? 0
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (record: any) => (
        <Progress
          percent={record.progress}
          size='small'
          status={record.progress === 100 ? 'success' : 'active'}
        />
      )
    },
    {
      title: 'Participation Rate',
      key: 'participationRate',
      render: (record: any) =>
        `${record.interventions?.participationRate ?? 0}%`
    }
  ]

  return (
    <div style={{ padding: 24, minHeight: '100vh' }}>
      <Helmet>
        <title>Participant Management | Incubation Platform</title>
      </Helmet>

      {/* Metrics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title='Total Participants'
              value={metrics.totalParticipants}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title='Total Required Interventions'
              value={metrics.totalRequiredInterventions}
              prefix={<PlusOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title='Total Completed Interventions'
              value={metrics.totalCompletedInterventions}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title='Need Consultant Assignment'
              value={metrics.totalNeedingAssignment}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Select
            style={{ width: '100%' }}
            value={selectedProgram}
            onChange={val => {
              setSelectedProgram(val)
            }}
          >
            <Option value='all'>All Programs</Option>
            {programs.map(p => (
              <Option key={p.id} value={p.id}>
                {p.name}
              </Option>
            ))}
          </Select>
        </Col>

        <Col span={8}>
          <Input
            placeholder='Search by name or sector'
            value={searchText}
            onChange={e => {
              setSearchText(e.target.value)
            }}
            allowClear
          />
        </Col>
        <Col span={8} style={{ alignItems: 'flex-end' }}>
          <Button
            type='primary'
            onClick={() => navigate('/consultant/participants/new')}
          >
            + Add New Participant
          </Button>
        </Col>
      </Row>

      {/* Participants Table */}
      <Card>
        <Table
          dataSource={filteredParticipants}
          columns={columns}
          rowKey='id'
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  )
}

export default OperationsParticipantsManagement
