// 定义固定的项目目录列表
// 如果数组为空，则允许浏览所有目录（默认行为）
// 如果数组不为空，则只能选择列表中的目录
export const FIXED_PROJECTS: string[] = [
  // 示例：
  // "/Users/username/projects/my-app",
  // "C:\\Projects\\my-app",
  "/home/opencode/workspace"
]

// 是否在固定项目目录中显示子文件夹
// true: 显示 FIXED_PROJECTS 目录下的所有子文件夹
// false: 只显示 FIXED_PROJECTS 中指定的目录
export const SHOW_SUBFOLDERS = true
