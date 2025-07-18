import React, { useState, useEffect } from 'react'
import {
  Row,
  Col,
  Card,
  Statistic,
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  UnorderedListOutlined,
  DollarOutlined
} from '@ant-design/icons'
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  where
} from 'firebase/firestore'
import { db } from '@/firebase'
import dayjs from 'dayjs'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'

const { Option } = Select

const SystemSetupForm: React.FC = () => {
  const [setupType, setSetupType] = useState<
    'intervention' | 'expense' | 'department'
  >('intervention')
  const [departments, setDepartments] = useState<any[]>([])

  const [interventions, setInterventions] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingRecord, setEditingRecord] = useState<any | null>(null)
  const [form] = Form.useForm()
  const { user, loading: identityLoading } = useFullIdentity()
  const [companyCode, setCompanyCode] = useState<string>('')

  useEffect(() => {
    if (!identityLoading && user?.companyCode) {
      setCompanyCode(user.companyCode)
      console.info('ompany Co: ', user.companyCode)
      fetchAll(user.companyCode) // Pass code to fetch
    }
  }, [identityLoading, user?.companyCode])

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async (code = companyCode) => {
    setLoading(true)
    try {
      const [intSnap, expSnap, deptSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'interventions'),
            where('companyCode', '==', code)
          )
        ),
        getDocs(
          query(
            collection(db, 'expenseTypes'),
            where('companyCode', '==', code)
          )
        ),
        getDocs(
          query(collection(db, 'departments'), where('companyCode', '==', code))
        )
      ])
      setInterventions(intSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setExpenses(expSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setDepartments(deptSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (error) {
      console.error(error)
      message.error('Error fetching data')
    } finally {
      setLoading(false)
    }
  }

  const metrics = [
    {
      title: 'Interventions',
      value: interventions.length,
      icon: <UnorderedListOutlined style={{ fontSize: 24, color: '#3f8600' }} />
    },
    {
      title: 'Expense Types',
      value: expenses.length,
      icon: <DollarOutlined style={{ fontSize: 24, color: '#cf1322' }} />
    }
  ]

  const columns =
    setupType === 'intervention'
      ? [
          { title: 'Area', dataIndex: 'areaOfSupport', key: 'areaOfSupport' },
          {
            title: 'Title',
            dataIndex: 'interventionTitle',
            key: 'interventionTitle'
          },
          {
            title: 'Department',
            dataIndex: 'departmentName',
            key: 'departmentName'
          }, // Show dept
          {
            title: 'Created',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: ts => dayjs(ts).format('YYYY-MM-DD')
          },
          {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
              <Button
                icon={<EditOutlined />}
                onClick={() => openEdit(record)}
              />
            )
          }
        ]
      : setupType === 'department'
      ? [
          { title: 'Department Name', dataIndex: 'name', key: 'name' },
          {
            title: 'Main?',
            dataIndex: 'isMain',
            key: 'isMain',
            render: val =>
              val ? <span style={{ color: 'green' }}>Main</span> : '—'
          },
          {
            title: 'Created',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: ts => dayjs(ts).format('YYYY-MM-DD')
          },
          {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
              <Button
                icon={<EditOutlined />}
                onClick={() => openEdit(record)}
              />
            )
          }
        ]
      : [
          { title: 'Name', dataIndex: 'name', key: 'name' },
          { title: 'Budget (ZAR)', dataIndex: 'budget', key: 'budget' },
          {
            title: 'Created',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: ts => dayjs(ts).format('YYYY-MM-DD')
          },
          {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
              <Button
                icon={<EditOutlined />}
                onClick={() => openEdit(record)}
              />
            )
          }
        ]

  const dataSource =
    setupType === 'intervention'
      ? interventions
      : setupType === 'department'
      ? departments
      : expenses

  const openEdit = (record: any) => {
    setEditingRecord(record)
    form.setFieldsValue(record)
    setModalVisible(true)
  }

  const openAdd = () => {
    setEditingRecord(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleFinish = async (values: any) => {
    setLoading(true)
    try {
      // Add companyCode to all values
      const baseValues = {
        ...values,
        companyCode,
        createdAt: new Date().toISOString()
      }
      if (setupType === 'intervention' && values.departmentId) {
        const dep = departments.find(d => d.id === values.departmentId)
        baseValues.departmentName = dep?.name || ''
      }

      if (editingRecord) {
        const ref = doc(
          db,
          setupType === 'intervention'
            ? 'interventions'
            : setupType === 'expense'
            ? 'expenseTypes'
            : 'departments',
          editingRecord.id
        )
        await updateDoc(ref, baseValues)
        message.success('Updated successfully')
      } else {
        await addDoc(
          collection(
            db,
            setupType === 'intervention'
              ? 'interventions'
              : setupType === 'expense'
              ? 'expenseTypes'
              : 'departments'
          ),
          baseValues
        )
        message.success('Created successfully')
      }
      await fetchAll(companyCode)
      setModalVisible(false)
    } catch (error) {
      console.error(error)
      message.error('Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24, minHeight: '100vh' }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {metrics.map(m => (
          <Col span={6} key={m.title}>
            <Card>
              <Statistic title={m.title} value={m.value} prefix={m.icon} />
            </Card>
          </Col>
        ))}
      </Row>
      <Card
        title={
          <Row justify='space-between'>
            <Col>
              <Select
                value={setupType}
                onChange={setSetupType}
                style={{ width: 200 }}
              >
                <Option value='intervention'>Interventions</Option>
                <Option value='expense'>Expense Types</Option>
                <Option value='department'>Departments</Option>
              </Select>
            </Col>
            <Col>
              <Button type='primary' icon={<PlusOutlined />} onClick={openAdd}>
                Add New Setup
              </Button>
            </Col>
          </Row>
        }
      >
        <Table
          columns={columns}
          dataSource={dataSource}
          rowKey='id'
          loading={loading}
        />
      </Card>
      <Modal
        visible={modalVisible}
        title={
          editingRecord
            ? `Edit ${
                setupType === 'intervention' ? 'Intervention' : 'Expense Type'
              }`
            : `Add ${
                setupType === 'intervention' ? 'Intervention' : 'Expense Type'
              }`
        }
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form layout='vertical' form={form} onFinish={handleFinish}>
          {setupType === 'intervention' ? (
            <>
              <Form.Item
                name='areaOfSupport'
                label='Area of Support'
                rules={[{ required: true }]}
              >
                <Input placeholder='e.g. Marketing, Finance' />
              </Form.Item>
              <Form.Item
                name='interventionTitle'
                label='Intervention Title'
                rules={[{ required: true }]}
              >
                <Input placeholder='e.g. Website Development' />
              </Form.Item>
              <Form.Item
                name='departmentId'
                label='Department'
                rules={[{ required: true }]}
              >
                <Select placeholder='Select Department'>
                  {departments.map(dep => (
                    <Option key={dep.id} value={dep.id}>
                      {dep.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          ) : setupType === 'department' ? (
            <>
              <Form.Item
                name='name'
                label='Department Name'
                rules={[{ required: true }]}
              >
                <Input placeholder='e.g. Finance, Operations' />
              </Form.Item>
              <Form.Item
                name='isMain'
                label='Main Department'
                valuePropName='checked'
              >
                <Select>
                  <Option value={true}>Yes (Access all)</Option>
                  <Option value={false}>No</Option>
                </Select>
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                name='name'
                label='Expense Name'
                rules={[{ required: true }]}
              >
                <Input placeholder='e.g. Travel, Supplies' />
              </Form.Item>
              <Form.Item
                name='budget'
                label='Default Budget (ZAR)'
                rules={[{ required: true }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </>
          )}
          <Form.Item>
            <Button type='primary' htmlType='submit' loading={loading}>
              {editingRecord ? 'Update' : 'Save'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SystemSetupForm
