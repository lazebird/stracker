# 网站/项目状态跟踪系统

一个基于Vue+Vite+TypeScript开发的网站/项目状态批量跟踪系统，支持GitHub项目和Docker镜像的版本信息跟踪。

## 功能特性

- 🔍 支持多种类型网站跟踪：
  - GitHub项目（最近代码提交时间、最新版本发布信息、Container版本信息）
  - Docker Hub镜像（最新版本发布信息）

- 📊 数据展示：
  - 美观的表格界面展示网站状态
  - 实时刷新单个网站数据
  - 状态指示器和错误信息显示

- 🤖 自动化：
  - GitHub Actions每日自动更新数据
  - 自动部署到GitHub Pages

## 技术栈

- **前端框架**: Vue 3 + TypeScript
- **构建工具**: Vite
- **包管理**: pnpm
- **样式**: CSS3
- **部署**: GitHub Pages
- **自动化**: GitHub Actions

## 项目结构

```
site_sub/
├── src/
│   ├── components/          # Vue组件
│   │   └── SiteTracker.vue # 主要的跟踪组件
│   ├── services/           # API服务
│   │   └── api.ts         # 数据获取服务
│   ├── types/              # TypeScript类型定义
│   │   └── index.ts       # 类型定义
│   ├── data/               # 数据文件
│   │   └── sites.json     # 网站状态数据
│   ├── App.vue            # 根组件
│   ├── main.ts            # 入口文件
│   └── style.css          # 全局样式
├── scripts/
│   └── fetch-data.ts      # 数据获取脚本
├── .github/workflows/
│   └── update-data.yml    # GitHub Actions配置
├── config.json            # 网站配置文件
├── package.json           # 项目配置
└── vite.config.ts         # Vite配置
```

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置网站

编辑 `config.json` 文件，添加要跟踪的网站：

```json
{
    "sites": [
        {
            "name": "XWF8188/LunaTV",
            "url": "https://github.com/XWF8188/LunaTV",
            "desc": "LunaTV Enhanced Edition"
        },
        {
            "name": "lampon/omnibox",
            "url": "https://hub.docker.com/r/lampon/omnibox/tags",
            "desc": "未开源 号称强聚合"
        }
    ]
}
```

支持的URL格式：
- GitHub项目: `https://github.com/owner/repo`
- Docker Hub镜像: `https://hub.docker.com/r/owner/repo/tags`

### 3. 获取数据

```bash
pnpm run fetch-data
```

### 4. 本地开发

```bash
pnpm run dev
```

### 5. 构建部署

```bash
pnpm run build
```

## 自动化部署

项目配置了GitHub Actions，会自动执行以下操作：

1. **每日自动更新**：每天北京时间上午9点自动获取最新数据
2. **自动部署**：数据更新后自动构建并部署到GitHub Pages
3. **手动触发**：也可以在GitHub界面手动触发更新

## 环境变量

在GitHub仓库设置中添加以下Secrets：

- `GITHUB_TOKEN`: GitHub访问令牌（用于访问GitHub API）

## API说明

### GitHub API
- 获取仓库信息：`GET /repos/{owner}/{repo}`
- 获取发布版本：`GET /repos/{owner}/{repo}/releases`

### Docker Hub API
- 获取镜像标签：`GET /v2/repositories/{owner}/{repo}/tags`

## 数据格式

生成的网站状态数据格式：

```json
[
  {
    "name": "项目名称",
    "url": "项目URL",
    "desc": "项目描述",
    "type": "网站类型",
    "lastCommitTime": "代码更新时间（Docker Hub镜像显示为-）",
    "latestVersion": "最新发布版本",
    "lastUpdateTime": "版本更新时间",
    "packageVersion": "Container版本（仅GitHub仓库显示）",
    "packageUpdateTime": "Container更新时间（仅GitHub仓库显示）",
    "status": "状态",
    "errorMessage": "错误信息（如果有）"
  }
]
```

## 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。