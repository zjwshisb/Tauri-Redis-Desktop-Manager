import React from 'react'
import 'xterm/css/xterm.css'
import 'antd/dist/reset.css'
import '@/App.css'
import 'mac-scrollbar/dist/mac-scrollbar.css'
import '@/i18n'
import '@/styles.less'
import { Layout, ConfigProvider, Spin, theme, App, notification } from 'antd'
import { useTranslation } from 'react-i18next'
import { observer } from 'mobx-react-lite'
import { StyleProvider } from '@ant-design/cssinjs'
import enUS from 'antd/locale/en_US'
import zhCN from 'antd/locale/zh_CN'
import { type Locale } from 'antd/es/locale'
import classNames from 'classnames'
import useStore from '@/hooks/useStore'
import TitleBar from '../TitleBar'
import WindowResize from './components/WindowResize'
import { ArgsProps } from 'antd/es/notification'
import { ERROR_NOTIFICATION } from '@/consts/event'
import { useEventListen } from '@/hooks/useEventListen'
import { getCurrentWindow } from '@tauri-apps/api/window'

const langs: Record<string, Locale> = {
  zh_CN: zhCN,
  en_US: enUS
}

const AppLayout: React.FC<
  React.PropsWithChildren<{
    loading?: boolean
    className?: string
    header?: React.ReactNode
  }>
> = ({ children, loading, className, header }) => {
  const { i18n } = useTranslation()

  const store = useStore()

  const [notificationApi, contextHolder] = notification.useNotification()

  useEventListen<ArgsProps>(
    ERROR_NOTIFICATION,
    (e) => {
      if (e.payload.message) {
        notificationApi.error(e.payload)
      }
    },
    getCurrentWindow()
  )

  const locale = React.useMemo(() => {
    return langs[i18n.language]
  }, [i18n.language])

  return (
    <ConfigProvider
      locale={locale}
      theme={{
        algorithm: store.setting.setting.dark_mode
          ? theme.darkAlgorithm
          : theme.defaultAlgorithm
      }}
    >
      <App>
        {contextHolder}
        {loading === true && <Spin spinning={true}></Spin>}
        {(loading === undefined || !loading) && (
          <StyleProvider hashPriority="high">
            <Layout className="h-screen w-screen flex flex-col">
              <WindowResize />
              <TitleBar />
              <Layout.Content
                className={classNames([' bg-white flex flex-col', className])}
              >
                <div className="flex-1 flex flex-col overflow-hidden">
                  {header !== undefined && header}
                  <div className="flex flex-1 overflow-hidden">{children}</div>
                </div>
              </Layout.Content>
            </Layout>
          </StyleProvider>
        )}
      </App>
    </ConfigProvider>
  )
}

export default observer(AppLayout)
