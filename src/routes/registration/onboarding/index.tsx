import React, { useState } from 'react'
import {
  Form,
  Input,
  Select,
  Upload,
  Button,
  DatePicker,
  Space,
  Typography,
  message,
  Card,
  Steps,
  Row,
  Col,
  Checkbox,
  Collapse,
  Spin
} from 'antd'

import { UploadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { auth, db, storage } from '@/firebase'
import {
  collection,
  addDoc,
  getDoc,
  doc,
  getDocs,
  query,
  where,
  updateDoc
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useEffect } from 'react'

const { Title } = Typography
const { Step } = Steps
const { Option } = Select
const documentTypes = [
  'Certified ID Copy',
  'Proof of Address',
  'B-BBEE Certificate',
  'Tax PIN',
  'CIPC',
  'Management Accounts',
  'Three Months Bank Statements'
]

const ParticipantRegistrationStepForm = () => {
  const [form] = Form.useForm()
  const [current, setCurrent] = useState(0)
  const [documents, setDocuments] = useState([])
  const [documentDetails, setDocumentDetails] = useState([])
  const [uploading, setUploading] = useState(false)
  const [documentFields, setDocumentFields] = useState(
    documentTypes.map(type => ({
      type,
      file: null,
      issueDate: null,
      expiryDate: null
    }))
  )
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>(
    []
  )
  const [interventionGroups, setInterventionGroups] = useState<any[]>([])
  const [interventionSelections, setInterventionSelections] = useState<
    Record<string, string[]>
  >({})

  useEffect(() => {
    const fetchUserData = async () => {
      const currentUser = auth.currentUser

      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid)
        const userSnap = await getDoc(userRef)

        if (userSnap.exists()) {
          const userData = userSnap.data()
          const companyCode = userData.companyCode || ''
          form.setFieldsValue({ companyCode })

          // 🔽 Fetch intervention groups for that company
          const interventionsSnapshot = await getDocs(
            query(
              collection(db, 'interventions'),
              where('companyCode', '==', companyCode)
            )
          )
          console.log(interventionGroups)

          const rawInterventions = interventionsSnapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().interventionTitle,
            area: doc.data().areaOfSupport
          }))

          // Group interventions by area
          const areaMap: Record<string, { id: string; title: string }[]> = {}

          rawInterventions.forEach(intervention => {
            if (!areaMap[intervention.area]) {
              areaMap[intervention.area] = []
            }
            areaMap[intervention.area].push({
              id: intervention.id,
              title: intervention.title
            })
          })

          // Format as grouped list
          const fetchedGroups = Object.entries(areaMap).map(
            ([area, interventions]) => ({
              area,
              interventions
            })
          )

          setInterventionGroups(fetchedGroups)
        }
      }
    }

    fetchUserData()
  }, [])

  const navigate = useNavigate()

  const getAgeGroup = (age: number): 'Youth' | 'Adult' | 'Senior' => {
    if (age <= 35) return 'Youth'
    if (age <= 59) return 'Adult'
    return 'Senior'
  }
  const formatReviewData = (values: any) => {
    return (
      <div>
        <p>
          <strong>Beneficiary Name:</strong> {values.beneficiaryName}
        </p>
        <p>
          <strong>Owner Name:</strong> {values.participantName}
        </p>
        <p>
          <strong>Email:</strong> {values.email}
        </p>
        <p>
          <strong>ID Number:</strong> {values.idNumber}
        </p>
        <p>
          <strong>Sector:</strong> {values.sector}
        </p>
        <p>
          <strong>Nature of Business:</strong> {values.natureOfBusiness}
        </p>
        <p>
          <strong>Stage:</strong> {values.stage}
        </p>
        <p>
          <strong>Gender:</strong> {values.gender}
        </p>
        <p>
          <strong>Age:</strong> {values.age}
        </p>
        <p>
          <strong>Date of Registration:</strong>{' '}
          {values.dateOfRegistration?.format('YYYY-MM-DD')}
        </p>
        <p>
          <strong>Registration Number:</strong> {values.registrationNumber}
        </p>
        <p>
          <strong>Years of Trading:</strong> {values.yearsOfTrading}
        </p>
        <p>
          <strong>Business Address:</strong> {values.businessAddress}
        </p>
        <p>
          <strong>Province:</strong> {values.province}
        </p>
        <p>
          <strong>City:</strong> {values.city}
        </p>
        <p>
          <strong>Host Community:</strong> {values.hub}
        </p>
        <p>
          <strong>Postal Code:</strong> {values.postalCode}
        </p>
        <p>
          <strong>Location:</strong> {values.location}
        </p>
        <p>
          <strong>Motivation:</strong> {values.motivation}
        </p>
        <p>
          <strong>Challenges:</strong> {values.challenges}
        </p>
        <p>
          <strong>Facebook:</strong> {values.facebook}
        </p>
        <p>
          <strong>Instagram:</strong> {values.instagram}
        </p>
        <p>
          <strong>LinkedIn:</strong> {values.linkedIn}
        </p>
      </div>
    )
  }

  const handleDateChange = (
    date: moment.Moment | null,
    field: 'issueDate' | 'expiryDate',
    index: number
  ): void => {
    const updated = [...documentFields]
    updated[index][field] = date
    setDocumentFields(updated)
  }

  const getExpiredDocuments = () => {
    const today = new Date()
    const oneWeekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

    return documentFields.filter(doc => {
      if (!doc.expiryDate) return false
      return doc.expiryDate.toDate() <= oneWeekFromNow
    })
  }

  const next = () => form.validateFields().then(() => setCurrent(current + 1))

  const prev = () => setCurrent(current - 1)

  const handleFileUpload = (file: any, index: number) => {
    const updated = [...documentFields]
    updated[index].file = file
    setDocumentFields(updated)
    return false // prevent auto-upload
  }
  const uploadFileAndGetURL = async (
    file: File,
    folder = 'participant_documents'
  ) => {
    try {
      // Use a unique filename to avoid collisions
      const fileName = `${Date.now()}_${file.name}`
      const fileRef = ref(storage, `${folder}/${fileName}`)

      // Upload the file
      await uploadBytes(fileRef, file)

      // Get the public download URL
      const url = await getDownloadURL(fileRef)

      return { url, name: fileName }
    } catch (error) {
      console.error('Upload failed:', error)
      throw error
    }
  }
  const uploadAllDocuments = async () => {
    const uploadedDocs = []

    for (const doc of documentFields) {
      if (!doc.file || !doc.issueDate) continue

      try {
        const { url, name } = await uploadFileAndGetURL(doc.file)

        uploadedDocs.push({
          type: doc.type,
          url, // ✅ correct public URL
          fileName: name,
          issueDate: doc.issueDate.format('YYYY-MM-DD'),
          expiryDate: doc.expiryDate?.format?.('YYYY-MM-DD') || null,
          status: 'valid'
        })
      } catch (err) {
        message.error(`Failed to upload ${doc.type}`)
      }
    }

    return uploadedDocs
  }

  const calculateCompliance = () => {
    const today = new Date()
    const oneWeekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

    const validDocs = documentFields.filter(doc => {
      if (!doc.file || !doc.issueDate) return false

      // No expiry date means it's valid
      if (!doc.expiryDate) return true

      // Otherwise check that it's not expired and at least 1 week away
      return doc.expiryDate.toDate() > oneWeekFromNow
    })

    return Math.round((validDocs.length / documentTypes.length) * 100)
  }

  const handleSubmit = async () => {
    await form.validateFields()
    const values = form.getFieldsValue(true) // true = get all values, even unmounted

    const complianceRate = calculateCompliance()

    if (complianceRate < 10) {
      message.error(
        'Compliance must be 10% or higher to approve this application.'
      )
      return
    }

    try {
      setUploading(true)
      const uploadedDocs = await uploadAllDocuments()

      const participant = {
        ...values,
        dateOfRegistration: values.dateOfRegistration?.toDate(), // Make sure it's a JS Date
        rating: 0,
        developmentType: '',
        ageGroup: getAgeGroup(values.age),
        applicationStatus: 'Pending',
        complianceRate,
        complianceDocuments: uploadedDocs,
        interventions: {
          required: Object.values(interventionSelections)
            .flat()
            .map(id => {
              const match = interventionGroups
                .flatMap(group => group.interventions)
                .find(i => i.id === id)
              return {
                id: match?.id,
                title: match?.title,
                area: interventionGroups.find(g =>
                  g.interventions.some(i => i.id === id)
                )?.area
              }
            }),
          assigned: [],
          completed: [],
          participationRate: 0
        }
      }

      await addDoc(collection(db, 'participants'), participant)
      message.success('Participant successfully applied!')

      // ✅ Update user role
      const userEmail = auth.currentUser?.email
      if (userEmail) {
        const usersRef = collection(db, 'users')
        const q = query(usersRef, where('email', '==', userEmail))
        const snapshot = await getDocs(q)

        if (!snapshot.empty) {
          const userDoc = snapshot.docs[0]
          await updateDoc(doc(db, 'users', userDoc.id), {
            role: 'Incubatee'
          })
        }
      }

      // ✅ Redirect to login
      navigate('/')

      // Optional: Reset form state
      setCurrent(0)
      form.resetFields()
      setDocumentFields(
        documentTypes.map(type => ({
          type,
          file: null,
          issueDate: null,
          expiryDate: null
        }))
      )
      setSelectedInterventions([])
    } catch (err) {
      console.error(err)
      message.error('Failed to register participant.')
    } finally {
      setUploading(false)
    }
  }

  const steps = [
    {
      title: 'Business Info',
      content: (
        <Card style={{ backgroundColor: '#f0f5ff' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name='beneficiaryName'
                label='Beneficiary Name'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name='participantName'
                label='Owner Name'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name='email'
                label='Email'
                rules={[
                  { required: true, message: 'Email is required' },
                  { type: 'email', message: 'Invalid email format' }
                ]}
              >
                <Input />
              </Form.Item>

              <Form.Item
                name='idNumber'
                label='ID Number'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name='sector'
                label='Sector'
                rules={[
                  { required: true, message: 'Please select or enter a sector' }
                ]}
              >
                <Select
                  showSearch
                  allowClear
                  placeholder='Select or type a sector'
                  optionFilterProp='children'
                  filterOption={(input, option) =>
                    (option?.children as string)
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                >
                  <Option value='Agriculture'>Agriculture</Option>
                  <Option value='Mining'>Mining</Option>
                  <Option value='Manufacturing'>Manufacturing</Option>
                  <Option value='Construction'>Construction</Option>
                  <Option value='Utilities'>
                    Utilities (Electricity, Water, Gas)
                  </Option>
                  <Option value='Wholesale and Retail Trade'>
                    Wholesale and Retail Trade
                  </Option>
                  <Option value='Transport and Logistics'>
                    Transport and Logistics
                  </Option>
                  <Option value='Information Technology'>
                    Information Technology
                  </Option>
                  <Option value='Finance and Insurance'>
                    Finance and Insurance
                  </Option>
                  <Option value='Real Estate'>Real Estate</Option>
                  <Option value='Professional and Technical Services'>
                    Professional and Technical Services
                  </Option>
                  <Option value='Education'>Education</Option>
                  <Option value='Healthcare and Social Assistance'>
                    Healthcare and Social Assistance
                  </Option>
                  <Option value='Tourism and Hospitality'>
                    Tourism and Hospitality
                  </Option>
                  <Option value='Public Administration'>
                    Public Administration
                  </Option>
                  <Option value='Creative and Cultural Industries'>
                    Creative and Cultural Industries
                  </Option>
                  <Option value='Other'>Other</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name='natureOfBusiness'
                label='Nature of Business'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name='stage'
                label='Stage'
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value='Ideation'>Ideation</Option>
                  <Option value='Startup'>Startup</Option>
                  <Option value='Early Stage'>Early Stage</Option>
                  <Option value='Growth'>Growth</Option>
                  <Option value='Expansion'>Expansion</Option>
                  <Option value='Maturity'>Maturity</Option>
                  <Option value='Decline'>Decline</Option>
                </Select>
              </Form.Item>
              <Form.Item
                name='gender'
                label='Gender'
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value='Male'>Male</Option>
                  <Option value='Female'>Female</Option>
                </Select>
              </Form.Item>
              <Form.Item name='age' label='Age' rules={[{ required: true }]}>
                <Input type='number' />
              </Form.Item>
              <Form.Item
                name='dateOfRegistration'
                label='Date of Registration'
                rules={[{ required: true, message: 'Please select a date' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name='registrationNumber' label='Registration Number'>
                <Input />
              </Form.Item>
              <Form.Item name='yearsOfTrading' label='Years of Trading'>
                <Input type='number' />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      )
    },
    {
      title: 'Business Location',
      content: (
        <Card style={{ backgroundColor: '#f6ffed' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name='businessAddress'
                label='Business Address'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name='province'
                label='Province'
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value='Eastern Cape'>Eastern Cape</Option>
                  <Option value='Free State'>Free State</Option>
                  <Option value='Gauteng'>Gauteng</Option>
                  <Option value='KwaZulu-Natal'>KwaZulu-Natal</Option>
                  <Option value='Limpopo'>Limpopo</Option>
                  <Option value='Mpumalanga'>Mpumalanga</Option>
                  <Option value='Northern Cape'>Northern Cape</Option>
                  <Option value='North West'>North West</Option>
                  <Option value='Western Cape'>Western Cape</Option>
                </Select>
              </Form.Item>
              <Form.Item name='city' label='City' rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item
                name='hub'
                label='Host Community'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name='postalCode'
                label='Postal Code'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name='location'
                label='Location'
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value='Urban'>Urban</Option>
                  <Option value='Rural'>Rural</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Card>
      )
    },
    {
      title: 'Motivation',
      content: (
        <Card style={{ backgroundColor: '#fff7e6' }}>
          <Form.Item
            name='motivation'
            label='Motivation (min 100 words)'
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name='challenges' label='Challenges'>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name='facebook' label='Facebook'>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name='instagram' label='Instagram'>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name='linkedIn' label='LinkedIn'>
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      )
    },
    {
      title: 'Documents',
      content: (
        <Space direction='vertical' style={{ width: '100%' }}>
          {documentFields.map((doc, index) => (
            <Row gutter={16} key={index} align='middle'>
              <Col span={4}>
                <strong>{doc.type}</strong>
              </Col>
              <Col span={5}>
                <Upload
                  beforeUpload={file => handleFileUpload(file, index)}
                  fileList={doc.file ? [doc.file] : []}
                  onRemove={() => {
                    const updated = [...documentFields]
                    updated[index].file = null
                    setDocumentFields(updated)
                  }}
                >
                  <Button icon={<UploadOutlined />}>Upload</Button>
                </Upload>
              </Col>
              <Col span={7}>
                <DatePicker
                  placeholder='Issue Date'
                  style={{ width: '100%' }}
                  value={documentFields[index].issueDate} // 👈 controlled
                  onChange={date => handleDateChange(date, 'issueDate', index)}
                />
              </Col>
              <Col span={7}>
                <DatePicker
                  placeholder='Expiry Date'
                  style={{ width: '100%' }}
                  value={documentFields[index].expiryDate} // 👈 controlled
                  onChange={date => handleDateChange(date, 'expiryDate', index)}
                />
              </Col>
            </Row>
          ))}
        </Space>
      )
    },
    {
      title: 'Interventions',
      content: (
        <Collapse>
          {interventionGroups.map(group => (
            <Collapse.Panel header={group.area} key={group.id}>
              <Checkbox.Group
                value={interventionSelections[group.area] || []}
                onChange={val => {
                  setInterventionSelections(prev => ({
                    ...prev,
                    [group.area]: val as string[]
                  }))
                }}
              >
                <Space direction='vertical'>
                  {group.interventions.map(i => (
                    <Checkbox key={i.id} value={i.id}>
                      {i.title}
                    </Checkbox>
                  ))}
                </Space>
              </Checkbox.Group>
            </Collapse.Panel>
          ))}
        </Collapse>
      )
    },
    {
      title: 'Review',
      content: (
        <>
          <Title level={4}>Review Your Details</Title>
          {formatReviewData(form.getFieldsValue(true))}
          <p>
            Compliance Score: <strong>{calculateCompliance()}%</strong>
          </p>

          {getExpiredDocuments().length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Typography.Text type='danger'>
                The following documents are expired or expiring within a week:
              </Typography.Text>
              <ul>
                {getExpiredDocuments().map((doc, index) => (
                  <li key={index}>
                    {doc.type} —{' '}
                    <strong>
                      {doc.expiryDate?.format
                        ? doc.expiryDate.format('YYYY-MM-DD')
                        : 'Invalid Date'}
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )
    }
  ]

  return (
    <Spin spinning={uploading} tip='Submitting...'>
      <Card style={{ padding: 24 }}>
        <Title level={3}>Participant Stepwise Registration</Title>
        <Steps current={current} style={{ marginBottom: 24 }}>
          {steps.map(s => (
            <Step key={s.title} title={s.title} />
          ))}
        </Steps>
        <Form layout='vertical' form={form}>
          {steps[current].content}
          <Form.Item>
            <Space style={{ marginTop: 24 }}>
              {current > 0 && <Button onClick={prev}>Back</Button>}
              {current < steps.length - 1 && (
                <Button type='primary' onClick={next}>
                  Next
                </Button>
              )}
              {current === steps.length - 1 && (
                <Button
                  type='primary'
                  onClick={handleSubmit}
                  loading={uploading}
                >
                  Submit
                </Button>
              )}
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </Spin>
  )
}

export default ParticipantRegistrationStepForm
