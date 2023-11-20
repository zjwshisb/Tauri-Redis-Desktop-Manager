import ModalQueryForm from '@/components/ModalQueryForm'
import React from 'react'
import request from '@/utils/request'
import { Button, Form, Input, InputNumber } from 'antd'

const LPop: React.FC<{
  keys: APP.ListKey
  onSuccess: () => void
}> = ({ keys, onSuccess }) => {
  return (
    <ModalQueryForm
      title="LPOP"
      width={400}
      afterQueryClose={onSuccess}
      defaultValue={{
        name: keys.name
      }}
      documentUrl="https://redis.io/commands/lpop/"
      trigger={<Button type="primary">LPOP</Button>}
      onQuery={async (v) => {
        const res = await request(
          'list/lpop',
          keys.connection_id,
          {
            db: keys.db,
            ...v
          },
          {
            showNotice: false
          }
        )
        return res.data
      }}
    >
      <Form.Item label={'Key'} name={'name'} rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item label={'Count'} name={'value'}>
        <InputNumber min={0} className="!w-full" />
      </Form.Item>
    </ModalQueryForm>
  )
}
export default LPop
