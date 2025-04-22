// ApprovalQueue.tsx
import React from "react";
import { Form, Input, Button, Select, Card, List, Typography } from "antd";

const dummyProposals = [
  { id: "PR-001", title: "Agritech Expansion", status: "Pending" },
  { id: "PR-002", title: "Renewable Energy Hub", status: "Pending" },
  { id: "PR-003", title: "FinTech Pilot", status: "Pending" },
];

export const ApprovalQueue = () => {
  const [form] = Form.useForm();

  const onFinish = (values: any) => {
    console.log("Approval Decision:", values);
  };

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={3}>Approval Queue</Typography.Title>

      <Card title="Pending Proposals" style={{ marginBottom: 24 }}>
        <List
          dataSource={dummyProposals}
          bordered
          renderItem={(item) => (
            <List.Item>
              <strong>{item.id}</strong> — {item.title} ({item.status})
            </List.Item>
          )}
        />
      </Card>

      <Card title="Submit Approval Decision">
        <Form layout="vertical" form={form} onFinish={onFinish}>
          <Form.Item
            name="proposal"
            label="Proposal ID"
            rules={[{ required: true, message: "Please enter the proposal ID" }]}
          >
            <Input placeholder="e.g. PR-001" />
          </Form.Item>

          <Form.Item
            name="decision"
            label="Decision"
            rules={[{ required: true, message: "Please select a decision" }]}
          >
            <Select
              placeholder="Choose one"
              options={[
                { value: "approve", label: "Approve" },
                { value: "reject", label: "Reject" },
              ]}
            />
          </Form.Item>

          <Form.Item name="comments" label="Comments">
            <Input.TextArea rows={3} placeholder="Optional comments..." />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit">
              Submit Decision
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};