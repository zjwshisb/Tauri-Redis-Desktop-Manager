import React from 'react'
import request from '@/utils/request'
import { Button, Space, Table, Tooltip } from 'antd'
import { EyeOutlined, EditOutlined } from '@ant-design/icons'
import useStore from '@/hooks/useStore'
import FieldForm from './components/FieldForm'
import DeleteField from './components/DeleteField'
import { actionIconStyle } from '@/utils/styles'
import { useTranslation } from 'react-i18next'

const Index: React.FC<{
  keys: APP.HashKey
}> = ({ keys }) => {
  const store = useStore()

  const [fields, setFields] = React.useState<APP.HashField[]>([])
  const cursor = React.useRef('0')
  const [more, setMore] = React.useState(true)

  const { t } = useTranslation()

  const getFields = React.useCallback(
    (reset = false) => {
      request<{
        cursor: string
        fields: APP.HashField[]
      }>('key/hash/hscan', keys.connection_id, {
        name: keys.name,
        db: keys.db,
        cursor: cursor.current
      }).then((res) => {
        cursor.current = res.data.cursor
        if (res.data.cursor === '0') {
          setMore(false)
        }
        if (reset) {
          setFields(res.data.fields)
        } else {
          setFields((p) => [...p].concat(res.data.fields))
        }
      })
    },
    [keys]
  )

  React.useEffect(() => {
    cursor.current = '0'
    setMore(true)
    getFields(true)
  }, [getFields])

  return (
    <div>
      <div>
        <FieldForm
          keys={keys}
          onSuccess={(f) => {
            setFields((p) => {
              return [...p].concat([f])
            })
          }}
          trigger={
            <Button type="primary" className="mb-4">
              new{' '}
            </Button>
          }
        />
      </div>
      <Table
        pagination={false}
        className="w-100"
        scroll={{
          x: 'auto'
        }}
        rowKey={'name'}
        dataSource={fields}
        bordered
        columns={[
          {
            title: '#',
            render(r, d, index) {
              return index + 1
            }
          },
          {
            dataIndex: 'name',
            title: t('Field Name'),
            sorter: (a, b) => (a.name > b.name ? 1 : -1)
          },
          {
            dataIndex: 'value',
            title: t('Field Value'),
            render(_, record) {
              return <Tooltip title={_}>{_}</Tooltip>
            }
          },
          {
            title: 'action',
            width: '300px',
            fixed: 'right',
            render(_, record, index) {
              return (
                <Space>
                  <FieldForm
                    trigger={
                      <EditOutlined
                        className="hover:cursor-pointer"
                        style={actionIconStyle}
                      ></EditOutlined>
                    }
                    keys={keys}
                    field={record}
                    onSuccess={(f) => {
                      setFields((prev) => {
                        const newFields = [...prev]
                        newFields[index] = f
                        return newFields
                      })
                    }}
                  />
                  <DeleteField
                    keys={keys}
                    field={record}
                    onSuccess={() => {
                      setFields((prev) => {
                        const newFields = [...prev]
                        newFields.splice(index, 1)
                        return newFields
                      })
                    }}
                  />
                  <EyeOutlined
                    style={actionIconStyle}
                    className="hover:cursor-pointer"
                    key={'view'}
                    onClick={() => {
                      store.fieldView.show({
                        title: record.name,
                        content: record.value
                      })
                    }}
                  />
                </Space>
              )
            }
          }
        ]}
      ></Table>
      {more && (
        <Button
          block
          className="my-4"
          onClick={() => {
            getFields()
          }}
        >
          load more
        </Button>
      )}
    </div>
  )
}
export default Index
