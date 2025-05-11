import React, { useEffect, useState } from 'react'
import {
  Table,
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Tag,
  Space,
  Typography,
  Spin,
  Modal,
  Form,
  Input,
  Select,
  message
} from 'antd'
import { db } from '@/firebase'
import {
  collection,
  getDocs,
  addDoc,
  doc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined
} from '@ant-design/icons'
import { Helmet } from 'react-helmet'
import { CSVLink } from 'react-csv'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/firebase'

const { Title } = Typography
const { Option } = Select

interface Consultant {
  id: string
  name: string
  email: string
  expertise: string[]
  assignmentsCount: number
  rating: number
  active: boolean
}

const defaultExpertise = [
  'Strategy',
  'Marketing',
  'Finance',
  'Technology',
  'Operations',
  'HR',
  'Compliance'
]

export const ConsultantPage: React.FC = () => {
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [loading, setLoading] = useState(true)
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [editingConsultant, setEditingConsultant] = useState<Consultant | null>(
    null
  )
  const [newConsultantId, setNewConsultantId] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    fetchConsultants()
  }, [])

  useEffect(() => {
    if (newConsultantId) {
      const timeout = setTimeout(() => {
        setNewConsultantId(null)
      }, 8000)
      return () => clearTimeout(timeout)
    }
  }, [newConsultantId])

  const fetchConsultants = async () => {
    setLoading(true)
    try {
      const snapshot = await getDocs(collection(db, 'consultants'))
      const consultantList = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as Consultant[]
      setConsultants(consultantList)
    } catch (error) {
      console.error('Error fetching consultants:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddConsultant = async (values: any) => {
    try {
      const { email, name, expertise, ratePerHour } = values

      // ✅ 1. Create Firebase Auth account
      const userCred = await createUserWithEmailAndPassword(auth, email, '0000')
      const uid = userCred.user.uid

      // ✅ 2. Save consultant details
      const newConsultant = {
        name,
        email,
        expertise,
        ratePerHour,
        assignmentsCount: 0,
        rating: 0,
        active: true,
        authUid: uid
      }

      await addDoc(collection(db, 'consultants'), newConsultant)

      // ✅ 3. Send Email (adjust this to use your email service or backend)
      await fetch('/api/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          subject: 'Welcome to Smart Incubation',
          message: `Hi ${name}, your consultant account has been created. You can login with:\n\nEmail: ${email}\nPassword: 0000\n\nPlease change your password after logging in.`
        })
      })

      message.success('Consultant registered and notified!')
      form.resetFields()
      setAddModalVisible(false)
      fetchConsultants()
    } catch (error: any) {
      console.error(error)
      message.error(error?.message || 'Failed to register consultant.')
    }
  }

  const handleEditConsultant = async (values: any) => {
    if (!editingConsultant) return
    try {
      await updateDoc(doc(db, 'consultants', editingConsultant.id), values)
      message.success('Consultant updated successfully!')
      setEditModalVisible(false)
      setEditingConsultant(null)
      editForm.resetFields()
      fetchConsultants()
    } catch (error) {
      console.error('Error updating consultant:', error)
      message.error('Failed to update consultant.')
    }
  }

  const handleDeleteConsultant = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'consultants', id))
      message.success('Consultant deleted successfully!')
      fetchConsultants()
    } catch (error) {
      console.error('Error deleting consultant:', error)
      message.error('Failed to delete consultant.')
    }
  }

  const handleActivateToggle = async (record: Consultant) => {
    try {
      await updateDoc(doc(db, 'consultants', record.id), {
        active: !record.active
      })
      message.success('Consultant status updated!')
      fetchConsultants()
    } catch (error) {
      console.error('Error toggling consultant:', error)
      message.error('Failed to update consultant.')
    }
  }

  const filteredConsultants = consultants.filter(
    c =>
      c.name.toLowerCase().includes(searchText.toLowerCase()) ||
      c.email.toLowerCase().includes(searchText.toLowerCase())
  )

  const activeCount = consultants.filter(c => c.active).length
  const totalConsultants = consultants.length
  const averageRating = totalConsultants
    ? (
        consultants.reduce((sum, c) => sum + (c.rating || 0), 0) /
        totalConsultants
      ).toFixed(1)
    : 0

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: Consultant, b: Consultant) => a.name.localeCompare(b.name)
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      sorter: (a: Consultant, b: Consultant) => a.email.localeCompare(b.email)
    },
    {
      title: 'Rate/hr',
      dataIndex: 'ratePerHour',
      key: 'ratePerHour',
      render: val => `R ${val}`
    },
    {
      title: 'Expertise',
      dataIndex: 'expertise',
      key: 'expertise',
      render: (expertise: string[]) => (
        <Space wrap>
          {expertise.map((item, index) => (
            <Tag color='blue' key={index}>
              {item}
            </Tag>
          ))}
        </Space>
      )
    },
    {
      title: 'Assignments',
      dataIndex: 'assignmentsCount',
      key: 'assignmentsCount',
      sorter: (a: Consultant, b: Consultant) =>
        a.assignmentsCount - b.assignmentsCount
    },
    {
      title: 'Rating',
      dataIndex: 'rating',
      key: 'rating',
      sorter: (a: Consultant, b: Consultant) => a.rating - b.rating
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>
          {active ? 'Active' : 'Inactive'}
        </Tag>
      ),
      sorter: (a: Consultant, b: Consultant) =>
        Number(a.active) - Number(b.active)
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Consultant) => (
        <Space>
          <Button
            size='small'
            icon={<EditOutlined />}
            onClick={() => {
              setEditingConsultant(record)
              editForm.setFieldsValue(record)
              setEditModalVisible(true)
            }}
          />
          <Button
            size='small'
            icon={<DeleteOutlined />}
            danger
            onClick={() => handleDeleteConsultant(record.id)}
          />
          <Button size='small' onClick={() => handleActivateToggle(record)}>
            {record.active ? 'Deactivate' : 'Activate'}
          </Button>
        </Space>
      )
    }
  ]

  return (
    <div
      style={{
        padding: 24,
        minHeight: '100vh',
        overflow: 'auto',
        background: '#fff'
      }}
    >
      <Helmet>
        <title>Consultants | Smart Incubation</title>
      </Helmet>

      {loading ? (
        <div
          style={{
            display: 'flex',
            height: '100vh',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Spin tip='Loading Consultants' size='large' />
        </div>
      ) : (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic title='Total Consultants' value={totalConsultants} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title='Active Consultants'
                  value={activeCount}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title='Average Rating'
                  value={averageRating}
                  suffix='/ 5'
                />
              </Card>
            </Col>
          </Row>
          <Col style={{ marginBottom: 10 }}>
            <Space>
              <Input.Search
                placeholder='Search by name or email'
                onSearch={value => setSearchText(value)}
                allowClear
                style={{ width: 250 }}
              />
              <Button
                type='primary'
                icon={<PlusOutlined />}
                onClick={() => setAddModalVisible(true)}
              >
                Add Consultant
              </Button>
              <Button icon={<DownloadOutlined />} type='default'>
                <CSVLink
                  filename='consultants.csv'
                  data={consultants}
                  style={{ color: 'inherit' }}
                >
                  Export
                </CSVLink>
              </Button>
            </Space>
          </Col>
          <Card>
            <Table
              columns={columns}
              dataSource={filteredConsultants}
              rowKey='id'
              pagination={{ pageSize: 8 }}
              rowClassName={record =>
                record.id === newConsultantId ? 'highlighted-row' : ''
              }
            />
          </Card>
        </>
      )}

      {/* Add Consultant Modal */}
      <Modal
        title='Add New Consultant'
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onOk={() => form.submit()}
        okText='Add Consultant'
        centered
        bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }} // 👉 limit height nicely
      >
        <Form form={form} layout='vertical' onFinish={handleAddConsultant}>
          <Form.Item
            name='name'
            label='Name'
            rules={[
              { required: true, message: 'Please enter consultant name' }
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name='email'
            label='Email'
            rules={[
              { required: true, message: 'Please enter consultant email' }
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name='expertise'
            label='Expertise Areas'
            rules={[{ required: true, message: 'Please select expertise' }]}
          >
            <Select
              mode='tags'
              style={{ width: '100%' }}
              placeholder='Add expertise areas'
            >
              {defaultExpertise.map(area => (
                <Option key={area} value={area}>
                  {area}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name='ratePerHour'
            label='Rate per Hour (ZAR)'
            rules={[{ required: true, message: 'Please enter a rate' }]}
          />
          <Input type='number' min={0} />
        </Form>
      </Modal>

      {/* Edit Consultant Modal */}
      <Modal
        title='Edit Consultant'
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={() => editForm.submit()}
        okText='Save Changes'
      >
        <Form form={editForm} layout='vertical' onFinish={handleEditConsultant}>
          <Form.Item
            name='name'
            label='Name'
            rules={[
              { required: true, message: 'Please enter consultant name' }
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name='email'
            label='Email'
            rules={[
              { required: true, message: 'Please enter consultant email' }
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name='expertise'
            label='Expertise Areas'
            rules={[{ required: true, message: 'Please select expertise' }]}
          >
            <Select
              mode='tags'
              style={{ width: '100%' }}
              placeholder='Add expertise areas'
            >
              {defaultExpertise.map(area => (
                <Option key={area} value={area}>
                  {area}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .highlighted-row {
          background-color: #fff7e6 !important;
          transition: background-color 0.8s ease;
          animation: fadeHighlight 8s forwards;
        }
        @keyframes fadeHighlight {
          0% { background-color: #fff7e6; }
          100% { background-color: white; }
        }
      `}</style>
    </div>
  )
}

export default ConsultantPage
