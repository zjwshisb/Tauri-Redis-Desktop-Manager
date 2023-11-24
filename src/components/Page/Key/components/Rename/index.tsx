import React from 'react'
import request from '@/utils/request'
import ModalForm from '@/components/ModalForm'
import FormInputItem from '@/components/Form/FormInputItem'

const Rename: React.FC<{
  keys: APP.Key
  trigger: React.ReactElement
  onSuccess: (name: string) => void
}> = (props) => {
  return (
    <ModalForm
      width={'800px'}
      defaultValue={{
        name: props.keys.name
      }}
      trigger={props.trigger}
      onSubmit={async (v) => {
        await request<number>('key/rename', props.keys.connection_id, {
          name: props.keys.name,
          new_name: v.name,
          db: props.keys.db
        })
        props.onSuccess(v.name)
      }}
      title={'RENAME'}
    >
      <FormInputItem name={'name'} label={'Name'} required />
    </ModalForm>
  )
}
export default Rename
