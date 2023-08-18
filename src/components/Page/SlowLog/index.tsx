import useRequest from '@/hooks/useRequest'
import { Spin, Table } from 'antd'
import React from 'react'
import dayjs from 'dayjs'

const SlowLog: React.FC<{
  connection: APP.Connection
}> = ({ connection }) => {
  const { data, loading } = useRequest<{
    logs: APP.SlowLog[]
    time: number
    count: number
  }>('server/slow-log', connection.id)

  return (
    <Spin spinning={loading}>
      <div className="mb-2">
        <div>slowlog-log-slower-than: {data?.time}us</div>
        <div>slowlog-max-len: {data?.count}</div>
      </div>
      <Table
        bordered
        rowKey={'uid'}
        pagination={false}
        size="small"
        dataSource={data?.logs}
        columns={[
          {
            dataIndex: 'id',
            align: 'center',
            title: 'id'
          },
          {
            dataIndex: 'processed_at',
            align: 'center',
            title: 'processed_at',
            render(v) {
              return dayjs.unix(v).format('YYYY-MM-DDTHH:mm:ssZ[Z]')
            }
          },
          {
            dataIndex: 'time',
            align: 'center',
            title: 'amount time(us)',
            sorter(a, b) {
              return a.time > b.time ? 1 : -1
            }
          },
          {
            dataIndex: 'cmd',
            align: 'center',
            title: 'cmd'
          },
          {
            dataIndex: 'client_ip',
            align: 'center',
            title: 'client_ip'
          },
          {
            dataIndex: 'client_name',
            align: 'center',
            title: 'client_name'
          }
        ]}
      ></Table>
    </Spin>
  )
}
export default SlowLog
