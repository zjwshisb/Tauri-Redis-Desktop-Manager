import React from 'react'
import request from '@/utils/request'
import ModalForm from '@/components/ModalForm'
import FormListItem from '@/components/Form/FormListItem'
import FormInputItem from '@/components/Form/FormInputItem'

const SInterStore: React.FC<{
  keys: APP.SetKey
}> = ({ keys }) => {
  return (
    <ModalForm
      documentUrl="https://redis.io/commands/sinterstore/"
      defaultValue={{
        value: [keys.name, undefined]
      }}
      onSubmit={async (v) => {
        await request<number>('set/sinterstore', keys.connection_id, {
          db: keys.db,
          ...v
        })
      }}
      title={'SINTERSTORE'}
    >
      <FormInputItem label="Destination" name="name" required />
      <FormListItem
        label="Keys"
        name="value"
        required
        renderItem={(field) => {
          return <FormInputItem {...field} required />
        }}
      ></FormListItem>
    </ModalForm>
  )
}
export default SInterStore
