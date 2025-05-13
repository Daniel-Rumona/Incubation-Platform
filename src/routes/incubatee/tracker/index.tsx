import React, { useEffect, useState } from 'react'
import {
  Layout,
  Card,
  Typography,
  Statistic,
  Row,
  Col,
  Table,
  Tag,
  Button,
  Space,
  message,
  Divider
} from 'antd'
import {
  getDocs,
  collection,
  query,
  where,
  doc,
  getDoc
} from 'firebase/firestore'
import { auth, db } from '@/firebase'
import { useNavigate } from 'react-router-dom'

const { Title } = Typography
const { Content } = Layout

const ApplicationTracker = () => {
  const [applications, setApplications] = useState<any[]>([])
  const [programs, setPrograms] = useState<any[]>([])
  const [companyCode, setCompanyCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [availablePrograms, setAvailablePrograms] = useState<any[]>([])
  const [beneficiaryName, setBeneficiaryName] = useState('')
  const [interventionGroups, setInterventionGroups] = useState<any[]>([])

  const navigate = useNavigate()

  useEffect(() => {
    const fetchUserData = async () => {
      const currentUser = auth.currentUser
      if (!currentUser) return

      try {
        const userRef = doc(db, 'users', currentUser.uid)
        const userSnap = await getDoc(userRef)
        if (!userSnap.exists()) return

        const userData = userSnap.data()
        const code = userData.companyCode || ''
        setCompanyCode(code)
        setBeneficiaryName(userData.beneficiaryName || '')

        // 🟢 Step 1: Load all programs
        const programsSnap = await getDocs(
          query(collection(db, 'programs'), where('companyCode', '==', code))
        )
        const allPrograms = programsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setPrograms(allPrograms)

        // 🟢 Step 2: Load all applications
        const appsSnap = await getDocs(
          query(
            collection(db, 'applications'),
            where('email', '==', currentUser.email)
          )
        )

        const apps = appsSnap.docs.map(doc => {
          const data = doc.data()
          const matchedProgram = allPrograms.find(p => p.id === data.programId)

          console.log('📎 Matching Program:', matchedProgram)

          return {
            id: doc.id,
            ...data,
            programName:
              matchedProgram?.programName ||
              matchedProgram?.name ||
              'Unnamed Program'
          }
        })

        setApplications(apps)

        // 🟢 Step 3: Filter available programs
        const appliedProgramIds = new Set(apps.map(app => app.programId))
        const available = allPrograms.filter(p => !appliedProgramIds.has(p.id))
        setAvailablePrograms(available)
      } catch (err) {
        console.error('Error loading data:', err)
        message.error('Could not load applications.')
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [navigate])

  const statusCounts = {
    Accepted: applications.filter(
      app => app.applicationStatus?.toLowerCase() === 'accepted'
    ).length,
    Declined: applications.filter(
      app => app.applicationStatus?.toLowerCase() === 'declined'
    ).length,
    Pending: applications.filter(
      app => app.applicationStatus?.toLowerCase() === 'pending'
    ).length,
    Total: applications.length
  }

  const applicationColumns = [
    {
      title: 'Program',
      dataIndex: 'programName'
    },
    {
      title: 'Status',
      dataIndex: 'applicationStatus',
      render: (text: string) => {
        const status = text?.toLowerCase()
        const color =
          status === 'accepted'
            ? 'green'
            : status === 'declined'
            ? 'red'
            : 'gold'
        return <Tag color={color}>{status?.toUpperCase()}</Tag>
      }
    },
    {
      title: 'Compliance',
      dataIndex: 'complianceRate',
      render: (rate: number) => <strong>{rate || 0}%</strong>
    }
  ]

  return (
    <Layout style={{ padding: '24px', background: '#fff' }}>
      <Content>
        <Card bordered={false} style={{ padding: '24px' }}>
          <Space direction='vertical' size='large' style={{ width: '100%' }}>
            <Title level={3}>🎯 My Application Tracker</Title>

            <Card bordered style={{ background: '#fafafa' }}>
              <Row gutter={[24, 24]}>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title='Total Applications'
                    value={statusCounts.Total}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title='Accepted'
                    value={statusCounts.Accepted}
                    valueStyle={{ color: 'green' }}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title='Pending'
                    value={statusCounts.Pending}
                    valueStyle={{ color: 'orange' }}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title='Declined'
                    value={statusCounts.Declined}
                    valueStyle={{ color: 'red' }}
                  />
                </Col>
              </Row>
            </Card>

            <Divider />

            <Card title='📋 My Applications' bodyStyle={{ padding: 0 }}>
              <Table
                rowKey='id'
                columns={applicationColumns}
                dataSource={applications}
                loading={loading}
                pagination={{ pageSize: 5 }}
                scroll={{ x: true }}
                style={{ padding: '16px' }}
              />
            </Card>
          </Space>
        </Card>
      </Content>
    </Layout>
  )
}

export default ApplicationTracker
