import { MainLayout } from "@/components/layouts"

/**
 * 新界面测试页面
 * 访问路径: /new-ui
 *
 * 用于测试基于4个frame设计的新界面
 */
export default function NewUIPage() {
  return (
    <MainLayout viewMode="default" showWorkspace={false}>
      {/* 默认状态 - 欢迎页 */}
    </MainLayout>
  )
}
