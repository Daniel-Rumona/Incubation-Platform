import React, { useEffect, useState } from 'react'
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  List,
  Tag,
  Space,
  Divider,
  Progress,
  Button,
  Timeline,
  Badge,
  Tabs,
  Table,
  Modal,
  Form,
  Select,
  Input,
  DatePicker,
  message,
  TimePicker,
  Layout
} from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FileSearchOutlined,
  ClockCircleOutlined,
  ScheduleOutlined,
  FileTextOutlined,
  FormOutlined,
  ApartmentOutlined,
  TeamOutlined,
  BarsOutlined,
  BellOutlined,
  DeleteOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { db } from '@/firebase'
import {
  collection,
  getDocs,
  setDoc,
  doc,
  Timestamp,
  getDoc,
  updateDoc,
  where,
  query
} from 'firebase/firestore'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
const { Title, Text, Paragraph } = Typography
const { TabPane } = Tabs
import dayjs from 'dayjs'
import { useGetIdentity } from '@refinedev/core'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { assign } from 'nodemailer/lib/shared'

export const OperationsDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [interventionDetailModalOpen, setInterventionDetailModalOpen] =
    useState(false)
  const [selectedIntervention, setSelectedIntervention] = useState<any>(null)
  const [confirming, setConfirming] = useState(false)
  const [participants, setParticipants] = useState<any[]>([])
  const [complianceDocuments, setComplianceDocuments] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('1')
  const [tasks, setTasks] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [calendarModalOpen, setCalendarModalOpen] = useState(false)
  const [taskForm] = Form.useForm()
  const [eventForm] = Form.useForm()
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [eventDetailModalOpen, setEventDetailModalOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [notificationModalOpen, setNotificationModalOpen] = useState(false)
  const [filterType, setFilterType] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'operations'>() // adjust if dynamic
  const [declineModalOpen, setDeclineModalOpen] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [declining, setDeclining] = useState(false)
  const [directCosts, setDirectCosts] = useState([
    { description: '', amount: '' }
  ])
  const [departments, setDepartments] = useState<any[]>([])
  const [userDepartment, setUserDepartment] = useState<any>(null)

  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [consultants, setConsultants] = useState<any[]>([])
  const [projectAdmins, setProjectAdmins] = useState<any[]>([])
  const [operationsUsers, setOperationsUsers] = useState<any[]>([])
  const { user, loading } = useFullIdentity()
  const [consultantDocIds, setConsultantDocIds] = useState<
    Record<string, string>
  >({})
  const [operationsDocIds, setOperationsDocIds] = useState<
    Record<string, string>
  >({})

  //  Use Effects
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'notifications'))
        const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        const filtered = all.filter(
          n => n.recipientRoles?.includes('operations') // or your actual logic
        )
        console.log(filtered)
        setNotifications(filtered)
      } catch (err) {
        console.error('Error loading notifications:', err)
      }
    }
    fetchNotifications()
  }, [])

  useEffect(() => {
    const fetchRelevantUsers = async () => {
      if (!user?.companyCode) return

      const q = query(
        collection(db, 'users'),
        where('companyCode', '==', user.companyCode)
      )
      const snapshot = await getDocs(q)
      const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

      setConsultants(allUsers.filter(u => u.role === 'consultant'))
      setProjectAdmins(allUsers.filter(u => u.role === 'projectadmin'))
      setOperationsUsers(allUsers.filter(u => u.role === 'operations'))

      const { consultantMap, opsMap } = await resolveUserDocIds(allUsers)
      console.log('[🔗 consultantMap]', consultantMap)
      console.log('[🔗 opsMap]', opsMap)

      // You can store these in state if needed:
      setConsultantDocIds(consultantMap)
      setOperationsDocIds(opsMap)
    }

    fetchRelevantUsers()
  }, [user?.companyCode])

  useEffect(() => {
    if (user?.companyCode) {
      // Fetch all departments for dropdown
      const fetchDepartments = async () => {
        const snapshot = await getDocs(
          query(
            collection(db, 'departments'),
            where('companyCode', '==', user.companyCode)
          )
        )
        const deps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setDepartments(deps)
        // Set current user's department
        if (user.departmentId) {
          setUserDepartment(deps.find(d => d.id === user.departmentId) || null)
        } else {
          setUserDepartment(deps.find(d => d.isMain) || null)
        }
      }
      fetchDepartments()
    }
  }, [user])

  const openInterventionDetails = async (interventionId: string) => {
    try {
      const ref = doc(db, 'assignedInterventions', interventionId)
      const snap = await getDoc(ref)
      if (snap.exists()) {
        setSelectedIntervention({ id: snap.id, ...snap.data() })
        setInterventionDetailModalOpen(true)
      } else {
        message.error('Intervention not found')
      }
    } catch (err) {
      console.error('Failed to fetch intervention:', err)
      message.error('Error loading intervention')
    }
  }
  const addCostField = () => {
    setDirectCosts([...directCosts, { description: '', amount: '' }])
  }

  const updateCostField = (
    index: number,
    field: 'description' | 'amount',
    value: string
  ) => {
    const updated = [...directCosts]
    updated[index][field] = value
    setDirectCosts(updated)
  }

  const markAsRead = async (id: string) => {
    await setDoc(doc(db, 'notifications', id), {
      ...notifications.find(n => n.id === id),
      readBy: {
        ...(notifications.find(n => n.id === id)?.readBy || {}),
        operations: true
      }
    })
    setNotifications(prev =>
      prev.map(n =>
        n.id === id ? { ...n, readBy: { ...n.readBy, operations: true } } : n
      )
    )
  }

  const removeCostField = (index: number) => {
    const updated = [...directCosts]
    updated.splice(index, 1)
    setDirectCosts(updated.length ? updated : [{ description: '', amount: '' }])
  }

  const markAsUnread = async (id: string) => {
    await setDoc(doc(db, 'notifications', id), {
      ...notifications.find(n => n.id === id),
      readBy: {
        ...(notifications.find(n => n.id === id)?.readBy || {}),
        operations: false
      }
    })
    setNotifications(prev =>
      prev.map(n =>
        n.id === id ? { ...n, readBy: { ...n.readBy, operations: false } } : n
      )
    )
  }

  const handleConfirmCompletion = async () => {
    if (!selectedIntervention) return
    setConfirming(true)
    try {
      const ref = doc(db, 'assignedInterventions', selectedIntervention.id)
      await updateDoc(ref, {
        operationsCompletionStatus: 'confirmed',
        status: 'pending'
      })

      await setDoc(doc(db, 'notifications', `notif-${Date.now()}`), {
        type: 'intervention-confirmed',
        interventionId: selectedIntervention.id,
        interventionTitle: selectedIntervention.interventionTitle,
        participantId: selectedIntervention.participantId,
        consultantId: selectedIntervention.consultantId,
        createdAt: Timestamp.now(),
        readBy: {},
        recipientRoles: ['projectadmin', 'consultant', 'operations'],
        message: {
          operations: `Intervention "${selectedIntervention.interventionTitle}" has been confirmed.`,
          consultant: `Operations confirmed completion of "${selectedIntervention.interventionTitle}".`,
          projectadmin: `Operations confirmed intervention "${selectedIntervention.interventionTitle}".`
        }
      })

      message.success('Intervention confirmed!')
      setInterventionDetailModalOpen(false)
    } catch (err) {
      console.error(err)
      message.error('Failed to confirm intervention.')
    } finally {
      setConfirming(false)
    }
  }

  const resolveUserDocIds = async (users: any[]) => {
    const consultantEmails = users
      .filter(u => u.role === 'consultant' || u.role === 'projectadmin')
      .map(u => u.email)

    const opsEmails = users
      .filter(u => u.role === 'operations')
      .map(u => u.email)

    const fetchByEmail = async (
      colName: string,
      emails: string[]
    ): Promise<Record<string, string>> => {
      const q = query(collection(db, colName), where('email', 'in', emails))
      const snapshot = await getDocs(q)

      return snapshot.docs.reduce((acc, doc) => {
        const data = doc.data()
        if (data.email) {
          acc[data.email] = doc.id
        }
        return acc
      }, {} as Record<string, string>)
    }

    const [consultantMap, opsMap] = await Promise.all([
      fetchByEmail('consultants', consultantEmails),
      fetchByEmail('operationsStaff', opsEmails)
    ])

    return { consultantMap, opsMap }
  }

  // Statistics Calculation
  const upToDate = complianceDocuments.filter(
    doc => doc.status === 'valid'
  ).length
  const needsReview = complianceDocuments.filter(
    doc => doc.status === 'expiring'
  ).length
  const overdue = complianceDocuments.filter(
    doc =>
      doc.status === 'expired' ||
      doc.status === 'missing' ||
      doc.status === 'pending'
  ).length
  const total = complianceDocuments.length

  // Fetch Tasks
  useEffect(() => {
    if (!user?.companyCode) return

    const fetchTasks = async () => {
      try {
        const q = query(
          collection(db, 'tasks'),
          where('companyCode', '==', user?.companyCode)
        )
        const snapshot = await getDocs(q)
        const taskList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setTasks(taskList)
      } catch (error) {
        console.error('Error fetching tasks:', error)
      }
    }
    const fetchAllOtherData = async () => {
      try {
        // Participants
        const participantSnapshot = await getDocs(
          collection(db, 'participants')
        )
        const participantsList = participantSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setParticipants(participantsList)
      } catch (error) {
        console.error('Error fetching other dashboard data:', error)
      }
    }
    const fetchComplianceDocuments = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'complianceDocuments'))
        const documents = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setComplianceDocuments(documents)
      } catch (error) {
        console.error('Error fetching compliance documents:', error)
      }
    }

    fetchComplianceDocuments()
    fetchTasks()
    fetchAllOtherData()
  }, [user?.companyCode])

  // Fetch Events
  useEffect(() => {
    if (!user?.companyCode) return

    const fetchEvents = async () => {
      try {
        const q = query(
          collection(db, 'events'),
          where('companyCode', '==', user?.companyCode)
        )
        console.log(user?.companyCode)
        const snapshot = await getDocs(q)
        const eventList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setEvents(eventList)
      } catch (error) {
        console.error('Error fetching events:', error)
      }
    }
    fetchEvents()
  }, [user?.companyCode])

  const handleEventClick = (event: any) => {
    const eventData = events.find(e => e.id === event.id)
    setSelectedEvent(eventData)
    setEventDetailModalOpen(true)
  }

  const handleAddEvent = async (values: any) => {
    const eventDate = values.date.format('YYYY-MM-DD')
    const eventTime = values.time.format('HH:mm')
    const [eventHour, eventMinute] = eventTime.split(':').map(Number)

    // Enforce 6am to 6pm only
    if (
      eventHour < 6 ||
      (eventHour === 18 && eventMinute > 0) ||
      eventHour > 18
    ) {
      return message.error('Event time must be between 06:00 and 18:00.')
    }

    // Check for clash (same date and time)
    const clash = events.some(
      e => e.date === eventDate && dayjs(e.time).format('HH:mm') === eventTime
    )
    if (clash) {
      return message.error('Another event is already scheduled for this time.')
    }

    try {
      const newId = `event-${Date.now()}`
      const newEvent = {
        id: newId,
        title: values.title,
        date: eventDate,
        time: values.time.toDate ? values.time.toDate() : values.time,
        type: values.type,
        createdAt: Timestamp.now()
      }
      await setDoc(doc(db, 'events', newId), newEvent)
      setEvents(prev => [...prev, newEvent])
      message.success('Event added successfully')
      setEventModalOpen(false)
      eventForm.resetFields()
    } catch (error) {
      console.error('Error adding event:', error)
      message.error('Failed to add event')
    }
  }

  const handleAddTask = async (values: any) => {
    const assignedEmail = values.assignedTo
    const isOps = values.assignedRole === 'operations'

    const assignedId = isOps
      ? operationsDocIds[assignedEmail]
      : consultantDocIds[assignedEmail]

    if (!assignedId) {
      message.error('Assigned user not found in collections')
      console.log(assignedEmail)
      console.log('Op Ids: ', operationsDocIds)
      return
    }

    const newTask = {
      title: values.title,
      dueDate: values.dueDate.toDate(),
      priority: values.priority,
      assignedRole: values.assignedRole,
      assignedTo: assignedId,
      createdAt: Timestamp.now(),
      status: 'To Do',
      // add department
      department: values.department || userDepartment?.id || null
    }

    await setDoc(doc(db, 'tasks', `task-${Date.now()}`), newTask)
    message.success('Task assigned successfully.')
    fetchTasks()
    setTaskModalOpen(false)
    taskForm.resetFields()
  }

  const handleCompleteTask = async (taskId: string) => {
    try {
      const updatedTasks = tasks.map(task =>
        task.id === taskId ? { ...task, status: 'Completed' } : task
      )
      setTasks(updatedTasks)
      // If you want to update it in Firestore also (optional):
      await setDoc(doc(db, 'tasks', taskId), {
        ...tasks.find(t => t.id === taskId),
        status: 'Completed'
      })
      message.success('Task marked as completed')
    } catch (error) {
      console.error('Error completing task:', error)
      message.error('Failed to complete task')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'success'
      case 'In Progress':
        return 'processing'
      case 'To Do':
        return 'default'
      case 'Active':
        return 'success'
      case 'Warning':
        return 'warning'
      case 'Closed':
        return 'default'
      default:
        return 'default'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'red'
      case 'Medium':
        return 'orange'
      case 'Low':
        return 'green'
      default:
        return 'blue'
    }
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'meeting':
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />
      case 'deadline':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      case 'event':
        return <CalendarOutlined style={{ color: '#52c41a' }} />
      case 'workshop':
        return <FileTextOutlined style={{ color: '#722ed1' }} />
      default:
        return <CalendarOutlined style={{ color: '#1890ff' }} />
    }
  }

  // Navigate to form management
  const goToFormManagement = () => {
    navigate('/operations/forms')
  }

  // Navigate to form responses
  const goToFormResponses = () => {
    navigate('/operations/form-responses')
  }

  // Navigate to resource management
  const goToResourceManagement = () => {
    navigate('/operations/resources')
  }

  // Navigate to participant management
  const goToParticipantManagement = () => {
    navigate('/operations/participants')
  }

  // Columns for form submissions table
  const formColumns = [
    {
      title: 'Form Name',
      dataIndex: 'formName',
      key: 'formName'
    },
    {
      title: 'Total Submissions',
      dataIndex: 'submissions',
      key: 'submissions',
      sorter: (a: any, b: any) => a.submissions - b.submissions
    },
    {
      title: 'Pending Review',
      dataIndex: 'pending',
      key: 'pending',
      render: (pending: number) => (
        <Badge
          count={pending}
          style={{
            backgroundColor: pending > 0 ? '#faad14' : '#52c41a',
            marginRight: '5px'
          }}
        />
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'Active' ? 'green' : 'default'}>{status}</Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button size='small' type='primary' onClick={goToFormResponses}>
            View Responses
          </Button>
        </Space>
      )
    }
  ]

  // Columns for resource allocation table
  const resourceColumns = [
    {
      title: 'Resource',
      dataIndex: 'resource',
      key: 'resource'
    },
    {
      title: 'Allocation',
      dataIndex: 'allocated',
      key: 'allocated',
      render: (allocated: number) => (
        <Progress
          percent={allocated}
          size='small'
          status={allocated > 90 ? 'exception' : 'normal'}
        />
      )
    },
    {
      title: 'Allocated To',
      dataIndex: 'allocatedTo',
      key: 'allocatedTo'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button size='small' type='primary' onClick={goToResourceManagement}>
          Manage
        </Button>
      )
    }
  ]

  // Columns for participants table
  const participantColumns = [
    {
      title: 'Participant',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      render: (stage: string) => (
        <Tag
          color={
            stage === 'Early' ? 'blue' : stage === 'Growth' ? 'green' : 'purple'
          }
        >
          {stage}
        </Tag>
      )
    },
    {
      title: 'Mentor Assigned',
      dataIndex: 'mentorAssigned',
      key: 'mentorAssigned',
      render: (assigned: string) => (
        <Badge
          status={assigned === 'Yes' ? 'success' : 'warning'}
          text={assigned}
        />
      )
    },
    {
      title: 'Next Review',
      dataIndex: 'nextReview',
      key: 'nextReview'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge status={getStatusColor(status) as any} text={status} />
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button size='small' type='primary' onClick={goToParticipantManagement}>
          View Details
        </Button>
      )
    }
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#fff' }}>
      <Helmet>
        <title>Operations Dashboard</title>
        <meta
          name='description'
          content='Manage daily operations and track incubatee progress'
        />
      </Helmet>

      {/* High-level Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Card>
            <Statistic
              title='Pending Tasks'
              value={tasks.filter(t => t.status !== 'Completed').length}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Card>
            <Statistic
              title='Upcoming Events'
              value={events.length}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6} lg={6}>
          <Card>
            <Statistic
              title='Completed Tasks'
              value={
                tasks.filter(
                  t => t.status === 'Completed' || t.status === 'confirmed'
                ).length
              }
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6} lg={6}>
          <Card>
            <Statistic
              title='Active Participants'
              value={participants.length}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main dashboard  */}
      <Row gutter={[16, 16]}>
        {/* Task Management */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <CheckCircleOutlined />
                <span>Task Management</span>
              </Space>
            }
            extra={
              <Button
                type='primary'
                size='small'
                onClick={() => setTaskModalOpen(true)}
              >
                Add Task
              </Button>
            }
            style={{ marginBottom: '24px' }}
          >
            <List
              size='small'
              dataSource={[...tasks].sort((a, b) => {
                if (a.status === 'Completed' && b.status !== 'Completed')
                  return 1
                if (a.status !== 'Completed' && b.status === 'Completed')
                  return -1
                return 0
              })}
              renderItem={task => (
                <List.Item
                  actions={[
                    task.status !== 'Completed' && (
                      <Button
                        key='complete'
                        type='link'
                        size='small'
                        onClick={() => handleCompleteTask(task.id)}
                      >
                        Complete
                      </Button>
                    )
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text
                          style={{
                            textDecoration:
                              task.status === 'Completed'
                                ? 'line-through'
                                : 'none'
                          }}
                        >
                          {task.title}
                        </Text>
                        <Tag color={getPriorityColor(task.priority)}>
                          {task.priority}
                        </Tag>
                      </Space>
                    }
                    description={`Due: ${dayjs(
                      task.dueDate.toDate ? task.dueDate.toDate() : task.dueDate
                    ).format('YYYY-MM-DD')}`}
                  />
                  {userDepartment?.isMain && (
                    <Form.Item
                      name='department'
                      label='Department'
                      rules={[
                        {
                          required: true,
                          message: 'Please select a department'
                        }
                      ]}
                    >
                      <Select placeholder='Select department'>
                        {departments.map(dep => (
                          <Select.Option key={dep.id} value={dep.id}>
                            {dep.name || dep.id}
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  )}

                  <Badge
                    status={getStatusColor(task.status) as any}
                    text={task.status}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* Calendar & Events */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <ScheduleOutlined />
                <span>Upcoming Events</span>
              </Space>
            }
            extra={
              <Button
                type='primary'
                size='small'
                onClick={() => setEventModalOpen(true)}
              >
                Add Event
              </Button>
            }
            style={{ marginBottom: '24px' }}
          >
            <Timeline mode='left'>
              {events.map((event, index) => (
                <Timeline.Item key={index} dot={getEventIcon(event.type)}>
                  <Text strong>
                    {event.date} - {event.title}
                  </Text>
                  <br />
                  <Space>
                    <Text type='secondary'>
                      Time: {dayjs(event.time).format('HH:mm')}
                    </Text>

                    <Tag
                      color={
                        event.type === 'meeting'
                          ? 'blue'
                          : event.type === 'deadline'
                          ? 'red'
                          : event.type === 'event'
                          ? 'green'
                          : 'purple'
                      }
                    >
                      {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                    </Tag>
                  </Space>
                </Timeline.Item>
              ))}
            </Timeline>
            <Button
              type='link'
              style={{ padding: 0 }}
              onClick={() => setCalendarModalOpen(true)}
            >
              View Full Calendar
            </Button>
          </Card>
        </Col>
      </Row>

      {/* Add Task Modal */}
      <Modal
        title='Add New Task'
        open={taskModalOpen}
        onCancel={() => setTaskModalOpen(false)}
        footer={null}
      >
        <Form form={taskForm} layout='vertical' onFinish={handleAddTask}>
          <Form.Item
            name='title'
            label='Task Title'
            rules={[{ required: true, message: 'Please input task title' }]}
          >
            <Input placeholder='Enter task title' />
          </Form.Item>
          <Form.Item name='assignedRole' label='Assign Role'>
            <Select
              placeholder='Select role'
              onChange={value => {
                setSelectedRole(value)
                taskForm.setFieldsValue({ assignedTo: undefined }) // ✅ clear assignedTo
              }}
            >
              <Select.Option value='consultant'>Consultant</Select.Option>
              <Select.Option value='projectadmin'>Project Admin</Select.Option>
              <Select.Option value='operations'>Operations</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name='assignedTo'
            label='Assign To'
            rules={[{ required: true }]}
          >
            <Select disabled={!selectedRole} placeholder='Select user'>
              {(selectedRole === 'consultant'
                ? consultants
                : selectedRole === 'projectadmin'
                ? projectAdmins
                : selectedRole === 'operations'
                ? operationsUsers
                : []
              ).map(user => (
                <Select.Option key={user.email} value={user.email}>
                  {user.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name='dueDate'
            label='Due Date'
            rules={[{ required: true, message: 'Please select due date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name='priority'
            label='Priority'
            rules={[{ required: true, message: 'Please select priority' }]}
          >
            <Select placeholder='Select priority'>
              <Select.Option value='High'>High</Select.Option>
              <Select.Option value='Medium'>Medium</Select.Option>
              <Select.Option value='Low'>Low</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type='primary' htmlType='submit' block>
              Add Task
            </Button>
          </Form.Item>
        </Form>
      </Modal>
      {/* Add Event Modal */}
      <Modal
        title='Add New Event'
        open={eventModalOpen}
        onCancel={() => setEventModalOpen(false)}
        footer={null}
      >
        <Form form={eventForm} layout='vertical' onFinish={handleAddEvent}>
          <Form.Item
            name='title'
            label='Event Title'
            rules={[{ required: true, message: 'Please input event title' }]}
          >
            <Input placeholder='Enter event title' />
          </Form.Item>
          <Form.Item
            name='date'
            label='Event Date'
            rules={[{ required: true, message: 'Please select event date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name='time' label='Event Time'>
            <TimePicker style={{ width: '100%' }} format='HH:mm' />
          </Form.Item>

          <Form.Item
            name='type'
            label='Event Type'
            rules={[{ required: true, message: 'Please select event type' }]}
          >
            <Select placeholder='Select event type'>
              <Select.Option value='meeting'>Meeting</Select.Option>
              <Select.Option value='deadline'>Deadline</Select.Option>
              <Select.Option value='event'>Event</Select.Option>
              <Select.Option value='workshop'>Workshop</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type='primary' htmlType='submit' block>
              Add Event
            </Button>
          </Form.Item>
        </Form>
      </Modal>
      {/* Calender Modal */}
      <Modal
        title='Full Calendar View'
        open={calendarModalOpen}
        onCancel={() => setCalendarModalOpen(false)}
        footer={null}
        width={900} // ✅ Wide but not crazy big
      >
        <FullCalendar
          plugins={[dayGridPlugin]}
          initialView='dayGridMonth'
          events={events.map(event => ({
            id: event.id,
            title: event.title,
            date: event.date
          }))}
          eventClick={info => handleEventClick(info.event)}
          height={600}
        />
      </Modal>
      {/* Calender Event Details */}
      <Modal
        title='Event Details'
        open={eventDetailModalOpen}
        onCancel={() => setEventDetailModalOpen(false)}
        footer={null}
      >
        {selectedEvent && (
          <div>
            <p>
              <strong>Title:</strong> {selectedEvent.title}
            </p>
            <p>
              <strong>Date:</strong> {selectedEvent.date}
            </p>
            <p>
              <strong>Time:</strong>{' '}
              {selectedEvent.time?.toDate
                ? dayjs(selectedEvent.time.toDate()).format('HH:mm')
                : 'N/A'}
            </p>
            <p>
              <strong>Type:</strong> {selectedEvent.type}
            </p>
          </div>
        )}
      </Modal>
      <Button
        type='primary'
        shape='circle'
        icon={
          <Badge
            count={notifications.filter(n => !n.readBy?.operations).length}
          >
            <BellOutlined />
          </Badge>
        }
        style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}
        onClick={() => setNotificationModalOpen(true)}
      />
      <Modal
        title='Notifications'
        open={notificationModalOpen}
        onCancel={() => setNotificationModalOpen(false)}
        footer={null}
        width={700}
      >
        <Select
          allowClear
          placeholder='Filter by Type'
          style={{ width: 250, marginBottom: 16 }}
          onChange={val => setFilterType(val)}
        >
          <Select.Option value='intervention-completed'>
            Completed
          </Select.Option>
          <Select.Option value='intervention-assigned'>Assigned</Select.Option>
          <Select.Option value='intervention-accepted'>Accepted</Select.Option>
          <Select.Option value='intervention-declined'>Declined</Select.Option>
          <Select.Option value='resource-update'>Resource Update</Select.Option>
        </Select>

        <List
          itemLayout='horizontal'
          dataSource={
            filterType
              ? notifications.filter(n => n.type === filterType)
              : notifications
          }
          renderItem={item => (
            <List.Item
              actions={[
                item.readBy?.operations ? (
                  <Button size='small' onClick={() => markAsUnread(item.id)}>
                    Mark Unread
                  </Button>
                ) : (
                  <Button size='small' onClick={() => markAsRead(item.id)}>
                    Mark Read
                  </Button>
                )
              ]}
            >
              <List.Item.Meta
                title={
                  <span>
                    {item.message?.operations || 'No message'}
                    {item.interventionId && (
                      <Button
                        size='small'
                        type='link'
                        onClick={() =>
                          openInterventionDetails(item.interventionId)
                        }
                        style={{ marginLeft: 8 }}
                      >
                        View Intervention
                      </Button>
                    )}
                  </span>
                }
                description={`Type: ${item.type}`}
              />
            </List.Item>
          )}
        />
      </Modal>
      <Modal
        open={interventionDetailModalOpen}
        onCancel={() => setInterventionDetailModalOpen(false)}
        title='Intervention Details'
        confirmLoading={confirming}
        footer={[
          <Button
            danger
            onClick={() => setDeclineModalOpen(true)}
            disabled={confirming}
          >
            Decline
          </Button>,
          <Button
            type='primary'
            onClick={handleConfirmCompletion}
            disabled={confirming}
          >
            Confirm
          </Button>
        ]}
        width={600}
      >
        {selectedIntervention ? (
          <div>
            <p>
              <strong>Title:</strong> {selectedIntervention.interventionTitle}
            </p>
            <p>
              <strong>Beneficiary:</strong>{' '}
              {selectedIntervention.beneficiaryName || 'N/A'}
            </p>
            <p>
              <strong>Consultant:</strong> {selectedIntervention.consultantName}
            </p>
            <p>
              <strong>Time Spent:</strong> {selectedIntervention.timeSpent || 0}{' '}
              hours
            </p>
            <p>
              <strong>Progress:</strong> {selectedIntervention.progress || 0}%
            </p>
            <p>
              <strong>Notes:</strong>{' '}
              {selectedIntervention.notes || 'No notes provided'}
            </p>

            <p>
              <strong>Proof of Execution:</strong>
            </p>
            {selectedIntervention.resources?.length ? (
              <ul>
                {selectedIntervention.resources.map((res: any, i: number) => (
                  <li key={i}>
                    <a
                      href={res.link}
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      {res.label || res.link}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No POE uploaded yet.</p>
            )}
            <Divider />
            <Title level={5}>Direct Project Costs</Title>

            {directCosts.map((cost, index) => (
              <Row
                gutter={12}
                key={index}
                style={{ marginBottom: 8, alignItems: 'center' }}
              >
                <Col span={10}>
                  <Input
                    placeholder='Description'
                    value={cost.description}
                    onChange={e =>
                      updateCostField(index, 'description', e.target.value)
                    }
                  />
                </Col>
                <Col span={8}>
                  <Input
                    placeholder='Amount'
                    value={cost.amount}
                    onChange={e =>
                      updateCostField(index, 'amount', e.target.value)
                    }
                    prefix='R'
                    type='number'
                    min='0'
                  />
                </Col>
                <Col span={6}>
                  <Button
                    icon={<DeleteOutlined />}
                    style={{ width: 50 }}
                    danger
                    onClick={() => removeCostField(index)}
                    block
                  ></Button>
                </Col>
              </Row>
            ))}

            <Button
              type='dashed'
              onClick={addCostField}
              block
              style={{ marginTop: 12 }}
            >
              + Add Cost Item
            </Button>
          </div>
        ) : (
          <p>Loading...</p>
        )}
      </Modal>
      <Modal
        title='Decline Intervention'
        open={declineModalOpen}
        onCancel={() => {
          setDeclineModalOpen(false)
          setDeclineReason('')
        }}
        onOk={async () => {
          if (!selectedIntervention) return
          if (!declineReason.trim())
            return message.warning('Please provide a reason.')

          setDeclining(true)
          try {
            const ref = doc(
              db,
              'assignedInterventions',
              selectedIntervention.id
            )
            await updateDoc(ref, {
              operationsCompletionStatus: 'rejected',
              status: 'assigned'
            })

            await setDoc(doc(db, 'notifications', `notif-${Date.now()}`), {
              type: 'intervention-declined-by-operations',
              interventionId: selectedIntervention.id,
              interventionTitle: selectedIntervention.interventionTitle,
              participantId: selectedIntervention.participantId,
              consultantId: selectedIntervention.consultantId,
              createdAt: Timestamp.now(),
              readBy: {},
              recipientRoles: ['projectadmin', 'consultant', 'operations'],
              message: {
                operations: `You declined "${selectedIntervention.interventionTitle}".`,
                consultant: `Operations declined "${selectedIntervention.interventionTitle}". Reason: ${declineReason}`,
                projectadmin: `Operations declined "${selectedIntervention.interventionTitle}".`
              }
            })

            message.success('Intervention declined.')
            setInterventionDetailModalOpen(false)
            setDeclineModalOpen(false)
            setDeclineReason('')
          } catch (err) {
            console.error(err)
            message.error('Failed to decline intervention.')
          } finally {
            setDeclining(false)
          }
        }}
        okText='Submit Reason'
        okButtonProps={{ loading: declining }}
      >
        <Input.TextArea
          rows={4}
          value={declineReason}
          onChange={e => setDeclineReason(e.target.value)}
          placeholder='Please provide a reason for declining this intervention...'
        />
      </Modal>
    </Layout>
  )
}

export default OperationsDashboard
