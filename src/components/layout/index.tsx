import React, { Children, useEffect, useMemo, useState } from 'react'
import { Layout, Menu, Typography, Spin, Button } from 'antd'
import { useGetIdentity, useLogout } from '@refinedev/core'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { Link, Outlet } from 'react-router-dom'
import { CurrentUser } from '@/components/layout/current-user'
import {
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  DashboardOutlined,
  PieChartOutlined,
  BarChartOutlined,
  FundProjectionScreenOutlined,
  FileTextOutlined,
  ReadOutlined,
  FileSearchOutlined,
  UsergroupAddOutlined,
  CheckSquareOutlined,
  FileProtectOutlined,
  PlusCircleOutlined,
  ProjectOutlined,
  FormOutlined,
  LaptopOutlined,
  TeamOutlined,
  FileDoneOutlined,
  SolutionOutlined,
  MessageOutlined,
  BankOutlined,
  UserOutlined,
  CalendarOutlined,
  AuditOutlined,
  ProfileOutlined,
  DollarOutlined,
  LineChartOutlined,
  ClockCircleOutlined,
  BookOutlined,
  DatabaseOutlined,
  OneToOneOutlined
} from '@ant-design/icons'
import { Upload, message } from 'antd'
import { EditOutlined, LoadingOutlined } from '@ant-design/icons'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { CompanyLogo } from '../CompanyLogo'

const { Header, Sider, Content } = Layout
const { Title } = Typography

type UserRole =
  | 'admin'
  | 'funder'
  | 'consultant'
  | 'incubatee'
  | 'operations'
  | 'director'
  | 'projectadmin'
  | 'investor'
  | 'government'

export const CustomLayout: React.FC = () => {
  const [logoUploading, setLogoUploading] = useState(false)
  const storage = getStorage()
  const { data: identity } = useGetIdentity()
  const { mutate: logout } = useLogout()
  const [role, setRole] = useState<UserRole | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!identity?.id) return
      const docRef = doc(db, 'users', String(identity.id))
      const userSnap = await getDoc(docRef)
      if (userSnap.exists()) {
        const userData = userSnap.data()
        const cleanRole = userData.role?.toLowerCase()?.replace(/\s+/g, '')
        setRole(cleanRole)
      }
    }
    fetchUserRole()
  }, [identity])

  useEffect(() => {
    const fetchUserDetails = async () => {
      if (!identity?.id) return

      const userRef = doc(db, 'users', String(identity.id))
      const userSnap = await getDoc(userRef)

      if (!userSnap.exists()) return

      const userData = userSnap.data()
      const cleanRole = userData.role?.toLowerCase()?.replace(/\s+/g, '')
      setRole(cleanRole)

      // If participant, fetch participant-specific logo
      if (cleanRole === 'incubatee' && userData.participantId) {
        const participantRef = doc(db, 'participants', userData.participantId)
        const participantSnap = await getDoc(participantRef)
        if (participantSnap.exists()) {
          const participantData = participantSnap.data()
          setLogoUrl(participantData.logoUrl || null)
        }
      }
    }

    fetchUserDetails()
  }, [identity])

  const getDashboardTitle = (role: UserRole | null) => {
    if (!role) return ''
    const nameMap = {
      projectadmin: 'Project Admin',
      funder: 'Sponsor',
      consultant: 'Consultant',
      operations: 'Operations',
      admin: 'Admin',
      director: 'Director',
      incubatee: 'Incubatee',
      investor: 'Investor',
      government: 'Government'
    }

    return `Smart Incubation : ${nameMap[role] || role} Dashboard`
  }

  const generateMenu = (items: any[]) =>
    items.map(({ key, label, to, icon, children }) => {
      if (children) {
        return {
          key,
          icon,
          label,
          children: generateMenu(children) // recursion
        }
      }
      return {
        key,
        icon,
        label: <Link to={to}>{label}</Link>
      }
    })

  const allMenus = {
    admin: [
      {
        key: 'dashboard',
        to: '/admin',
        label: 'Dashboard',
        icon: <DashboardOutlined />
      },
      {
        key: 'monitoring',
        to: '/admin/monitoring',
        label: 'Monitoring',
        icon: <BarChartOutlined />
      }
    ],
    investor: [
      {
        key: 'dashboard',
        to: '/investor',
        label: 'Dashboard',
        icon: <DashboardOutlined />
      },
      {
        key: 'opportunities',
        to: '/investor/opportunities',
        label: 'Opportunities',
        icon: <FundProjectionScreenOutlined />
      },
      {
        key: 'portfolio',
        to: '/investor/portfolio',
        label: 'Portfolio',
        icon: <ProfileOutlined />
      },
      {
        key: 'due-diligence',
        to: '/investor/due-diligence',
        label: 'Due Diligence',
        icon: <AuditOutlined />
      },
      {
        key: 'analytics',
        to: '/investor/analytics',
        label: 'Analytics',
        icon: <BarChartOutlined />
      },
      {
        key: 'documents',
        to: '/investor/documents',
        label: 'Documents',
        icon: <FileTextOutlined />
      },
      {
        key: 'calendar',
        to: '/investor/calendar',
        label: 'Calendar',
        icon: <CalendarOutlined />
      }
    ],
    government: [
      {
        key: 'dashboard',
        to: '/government',
        label: 'Dashboard',
        icon: <DashboardOutlined />
      },
      {
        key: 'analytics',
        to: '/government/analytics',
        label: 'Analytics',
        icon: <BarChartOutlined />
      },
      {
        key: 'participants',
        to: '/government/participants',
        label: 'Participants',
        icon: <TeamOutlined />
      },
      {
        key: 'programs',
        to: '/government/programs',
        label: 'Programs',
        icon: <ProjectOutlined />
      },
      {
        key: 'reports',
        to: '/government/reports',
        label: 'Reports',
        icon: <ReadOutlined />
      }
    ],
    projectadmin: [
      {
        key: 'dashboard',
        to: '/projectadmin',
        label: 'Dashboard',
        icon: <DashboardOutlined />
      },
      {
        key: 'applications',
        to: '/applications',
        label: 'Applications',
        icon: <FormOutlined />
      },
      {
        key: 'programs',
        to: '/programs',
        label: 'Programs Onboarding',
        icon: <LaptopOutlined />
      },
      {
        key: 'analytics',
        to: '/projectadmin/monitoring',
        label: 'M & E Monitoring',
        icon: <PieChartOutlined />
      },
      {
        key: 'impact',
        to: '/projectadmin/impact',
        label: 'Impact Analytics',
        icon: <FundProjectionScreenOutlined />
      },
      {
        key: 'reports',
        to: '/projectadmin/reports',
        label: 'Reports',
        icon: <ReadOutlined />
      }
    ],

    funder: [
      {
        key: 'dashboard',
        to: '/funder',
        label: 'Dashboard',
        icon: <DashboardOutlined />
      },
      {
        key: 'opportunities',
        to: '/funder/opportunities',
        label: 'Opportunities',
        icon: <PlusCircleOutlined />
      },
      {
        key: 'analytics',
        to: '/funder/analytics',
        label: 'Analytics',
        icon: <BarChartOutlined />
      }
    ],

    consultant: [
      {
        key: 'dashboard',
        to: '/consultant',
        label: 'Dashboard',
        icon: <DashboardOutlined />
      },
      {
        key: 'allocated',
        label: 'Interventions',
        icon: <FileProtectOutlined />,
        children: [
          {
            key: 'allocated-active',
            label: 'Active',
            to: '/consultant/allocated'
          },
          {
            key: 'allocated-history',
            label: 'History',
            to: '/consultant/allocated/history'
          }
        ]
      },
      {
        key: 'tasksEvents',
        to: '/tasksEvents',
        label: 'Tasks & Events',
        icon: <BookOutlined />
      },
      {
        key: 'appointments',
        to: '/consultant/appointments',
        label: 'Appointments',
        icon: <ClockCircleOutlined />
      },
      {
        key: 'feedback',
        to: '/consultant/feedback',
        label: 'Participant Insights',
        icon: <MessageOutlined />
      },
      {
        key: 'analytics',
        to: '/consultant/analytics',
        label: 'Analytics',
        icon: <LineChartOutlined />
      }
    ],

    director: [
      {
        key: 'dashboard',
        to: '/director',
        label: 'Dashboard',
        icon: <DashboardOutlined />
      },
      {
        key: 'operators',
        to: '/director/operators',
        label: 'Operators Onboarding',
        icon: <UsergroupAddOutlined />
      },
      {
        key: 'programs',
        to: '/programs',
        label: 'Programs Onboarding',
        icon: <LaptopOutlined />
      },
      {
        key: 'expenses',
        to: '/expenses',
        label: 'Project Expenses',
        icon: <FundProjectionScreenOutlined />
      },
      {
        key: 'system',
        to: '/system',
        label: 'System Setup',
        icon: <BankOutlined />
      },
      {
        key: 'sponsor',
        to: '/funder',
        label: 'Sponsor View',
        icon: <ProfileOutlined />
      }
    ],

    incubatee: [
      {
        key: 'dashboard',
        to: '/incubatee',
        label: 'My Dashboard',
        icon: <DashboardOutlined />
      },
      {
        key: 'diagnostic',
        to: '/incubatee/diagnostic',
        label: 'Diagnostic Assessment',
        icon: <FormOutlined />
      },
      {
        key: 'interventions',
        to: '/incubatee/interventions',
        label: 'Tracker',
        icon: <SolutionOutlined />
      },
      {
        key: 'financials',
        to: '/incubatee/financials',
        label: 'Financial Portal',
        icon: <DollarOutlined />
      },
      {
        key: 'projects',
        to: '/incubatee/projects',
        label: 'Key Metrics',
        icon: <BarChartOutlined />
      },
      {
        key: 'documents',
        to: '/incubatee/documents',
        label: 'Upload Documents',
        icon: <FileDoneOutlined />
      }
    ],

    operations: [
      {
        key: 'dashboard',
        to: '/operations',
        label: 'Dashboard',
        icon: <DashboardOutlined />
      },
      {
        key: 'consultants',
        to: '/operations/consultants',
        label: 'Consultants',
        icon: <SolutionOutlined />,
        children: [
          {
            key: 'consultants-db',
            to: '/operations/consultants',
            label: 'Manage',
            icon: <DatabaseOutlined />
          },
          {
            key: 'consultants-assignments',
            to: '/operations/assignments',
            label: 'Assignments',
            icon: <FileProtectOutlined />
          },
          {
            key: 'consultants-tasks',
            to: '/operations/tasks',
            label: 'Tasks',
            icon: <OneToOneOutlined />
          }
        ]
      },
      {
        key: 'interventions',
        to: '/interventions',
        label: 'Interventions Database',
        icon: <FileSearchOutlined />
      },

      {
        key: 'participants',
        label: 'Incubatees',
        icon: <TeamOutlined />,
        children: [
          {
            key: 'participants-db',
            to: '/operations/participants',
            label: 'View All',
            icon: <DatabaseOutlined />
          },
          {
            key: 'applications',
            to: '/applications',
            label: 'Applications',
            icon: <FormOutlined />
          },
          {
            key: 'compliance',
            to: '/operations/compliance',
            label: 'Compliance',
            icon: <CheckSquareOutlined />
          }
        ]
      },
      {
        key: 'programs',
        to: '/programs',
        label: 'Programs Onboarding',
        icon: <LaptopOutlined />
      },
      {
        key: 'resources',
        to: '/operations/resources',
        label: 'Resources',
        icon: <FundProjectionScreenOutlined />
      },
      {
        key: 'system',
        to: '/system',
        label: 'System Setup',
        icon: <BankOutlined />
      },
      {
        key: 'reports',
        to: '/operations/reports',
        label: 'Reports',
        icon: <ReadOutlined />
      }
    ]
  }

  const menuItems = useMemo(() => {
    if (!role) return []
    return [
      ...generateMenu(allMenus[role] || []),
      {
        key: 'chat',
        label: <Link to='/chat'>Chat</Link>,
        icon: <MessageOutlined />
      }
    ]
  }, [role])

  const siderWidth = 220
  const headerHeight = 64

  if (!role) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Spin tip='Loading layout...' size='large' />
      </div>
    )
  }

  return (
    <Layout style={{ height: '100vh' }}>
      {/* Sider */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={value => setCollapsed(value)}
        collapsedWidth={80}
        width={siderWidth}
        trigger={null}
        style={{
          background: '#ffffff',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: 100,
          boxShadow: '2px 0 5px rgba(0,0,0,0.06)'
        }}
      >
        {/* Logo */}
        <CompanyLogo collapsed={collapsed} />

        {/* Menu */}
        <Menu
          theme='light'
          mode='inline'
          items={menuItems}
          style={{ borderRight: 'none' }}
        />

        <div style={{ padding: 16, borderTop: '1px solid #f0f0f0' }}>
          <Button block danger onClick={() => logout()}>
            Logout
          </Button>
        </div>
      </Sider>

      {/* Layout */}
      <Layout
        style={{
          marginLeft: collapsed ? 80 : siderWidth,
          transition: 'all 0.2s ease-in-out'
        }}
      >
        <Header
          style={{
            background: '#ffffff',
            padding: '0 24px',
            position: 'fixed',
            top: 0,
            left: collapsed ? 80 : siderWidth,
            right: 0,
            height: headerHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e0e0e0',
            zIndex: 90,
            transition: 'all 0.2s ease-in-out'
          }}
        >
          <Button
            type='text'
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '18px',
              width: 48,
              height: 48
            }}
          />
          <Title level={4} style={{ margin: 0, flex: 1, textAlign: 'center' }}>
            {getDashboardTitle(role)}
          </Title>
          <CurrentUser />
        </Header>

        <Content
          style={{
            marginTop: headerHeight,
            height: `calc(100vh - ${headerHeight}px)`,
            background: '#f5f5f5'
          }}
        >
          <div
            style={{
              padding: 15,
              background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
