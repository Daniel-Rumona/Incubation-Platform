import React from 'react'
import { Breadcrumb } from 'antd'
import { HomeOutlined, PlusOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import InquiryForm from '@/components/receptionist/InquiryForm'

const NewInquiry: React.FC = () => {
  return (
    <div>
      {/* Breadcrumb Navigation */}
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item>
          <Link to="/receptionist/dashboard">
            <HomeOutlined /> Dashboard
          </Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <Link to="/receptionist/inquiries">
            Inquiries
          </Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <PlusOutlined /> New Inquiry
        </Breadcrumb.Item>
      </Breadcrumb>

      {/* Inquiry Form */}
      <InquiryForm />
    </div>
  )
}

export default NewInquiry 