import React from 'react'
import { Card } from 'antd'
import { useTranslation } from 'react-i18next'
import { Line } from '@ant-design/plots'
import dayjs from 'dayjs'

interface Point {
  memory: any
  time: any
}

const Memory: React.FC<{
  items: Record<string, any>
}> = ({ items }) => {
  const { t } = useTranslation()

  const [lines, setLines] = React.useState<Point[]>([])

  React.useEffect(() => {
    if (items.used_memory !== undefined) {
      setLines((prev) => {
        return [...prev].concat([
          {
            time: dayjs().format('HH:mm:ss'),
            memory: parseFloat((items.used_memory / (1024 * 1024)).toFixed(2))
          }
        ])
      })
    }
  }, [items])

  return (
    <Card title={t('Memory')} className="mt-4">
      <Line
        slider={{
          start: 0,
          end: 1
        }}
        data={lines}
        xField="time"
        yAxis={{
          label: {
            formatter(text, item, index) {
              return text + 'M'
            }
          }
        }}
        xAxis={{}}
        yField="memory"
        smooth={true}
        animation={false}
      />
    </Card>
  )
}
export default Memory
