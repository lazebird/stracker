# stracker — 网站/项目状态跟踪系统

Vue 3 + TypeScript + Vite + pnpm。跟踪 GitHub 项目（代码提交/版本发布/Container包）和 Docker Hub 镜像的更新状态。

## 关键命令

```bash
pnpm dev              # 开发服务器
pnpm build            # vue-tsc 类型检查 → vite 构建（必须全部通过）
pnpm fetch-data       # tsx scripts/fetch-data.ts 获取所有站点数据
```

`build` = typecheck + bundle，两步合一。`vue-tsc` 失败 → 构建失败。

## 目录结构

```
src/
  services/
    api.ts               # 编排层：getGitHubRepoInfo, getSiteStatus, resolvePackage
    github-parse.ts      # 纯HTML解析：extractDefaultBranch, parseGitHubRepoPage
    github-scraper.ts    # HTTP抓取 + 调用parse层
    github-api.ts        # GitHub REST API（双重 fallback: token → public）
    docker-api.ts        # Docker Hub Tags API
    url-parser.ts        # parseSiteUrl()
  composables/
    useSnapshot.ts       # localStorage 快照保存/加载/对比
    useDraggable.ts      # 弹窗拖拽（被 useSnapshot 内部使用）
    useSort.ts           # 三字段排序
  components/
    SiteTracker.vue      # 主表格
    SnapshotModal.vue    # 快照历史弹窗
  utils/
    format.ts            # formatTime, getStatusText, getCodeUpdateTime 等
    package-names.ts     # generatePackageNames 通用包名生成
    retry.ts             # withFallback 策略链重试
  types/index.ts         # Site, SiteStatus, GitHubRepo, GitHubRelease, DockerHubTag
scripts/
  fetch-data.ts          # CLI入口：读 config.json → ApiService → 写 public/data/sites.json
config.json              # 站点列表（增删改查在此文件）
data/                    # .gitignore，数据不在 repo 中
public/data/sites.json   # 构建产物，最终部署
```

## 架构要点

### 数据流
```
config.json → scripts/fetch-data.ts → ApiService
  ├─ GitHub: 先网页抓取 (github-scraper) → 解析 (github-parse) → 提交页面二次请求
  │          → 若失败，fallback 到 REST API (github-api, token→public)
  └─ Docker Hub: 直接 API (docker-api)
→ public/data/sites.json
→ SiteTracker.vue 加载 → 与 localStorage 快照对比 → 标记"更新"
```

### 服务层采用多策略回退模式
- **网页抓取优先**：`github-scraper.parseRepoPage() → scrapeRepoPage()`
- **API 回退**：`github-api.fetchRepoViaApi()`（带 GITHUB_TOKEN → 无 token 双重 try）
- **`withFallback`**：`utils/retry.ts` 可用，但部分逻辑仍手写 fallback 链

### 快照对比
- SiteTracker.vue 加载时从 localStorage 读取快照
- `compareWithSnapshot` 比较 4 个字段：`latestVersion` / `packageVersion` / `lastCommitTime` / `packageUpdateTime`
- 仅当**新旧值均非 null** 且不同时才标记"更新"
- 当前无快照 → 全部标记 `isNew`

### config.json
站点配置入口。`pkgname` 可选字段用于指定 GitHub Container package 名称，不指定则自动猜测。

### 已知问题
所有已知陷阱和故障记录统一保存在 `doc/known-issues.md`。遇到异常先查阅该文件。

## 修改指引

1. **增删站点** → 编辑 `config.json`，再运行 `pnpm fetch-data`
2. **修复解析逻辑** → 改 `github-parse.ts`（纯函数，可独立测试）
3. **修复抓取策略** → 改 `github-scraper.ts` 或 `github-api.ts`
4. **改展示逻辑** → `format.ts`（纯函数）或 `SiteTracker.vue`
5. **改快照行为** → `useSnapshot.ts`
6. 验证：`pnpm build`（必须通过）
