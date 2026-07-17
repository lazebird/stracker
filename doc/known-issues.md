# Known Issues

## 1. `extractDefaultBranch` 策略优先级导致错误分支检测

### 现象
Decohererk/DecoTV 的 `lastCommitTime` 解析为 `2026-06-08`（标签创建日期），而非实际最后提交日 `2026-06-30`。导致 `compareWithSnapshot` 将此差异标记为"更新"。

### 根因
`extractDefaultBranch` 的策略2（`css-truncate-target` span）匹配到了仓库页面上标签 `v1.5.0` 的 `<span>` 元素，而不是分支选择器。提前返回 `v1.5.0`，导致策略3 `"defaultBranch":"main"` JSON 永远不会执行。

### 问题链
1. `extractDefaultBranch` 返回 `v1.5.0`（标签名，非分支名）
2. commits URL 变为 `/commits/v1.5.0/`（标签的时间线，非 `main` 分支）
3. 标签页面的第一个 `committedDate` 是标签创建日期 Jun 8
4. `repoData.pushed_at` 被覆盖为 Jun 8
5. `compareWithSnapshot` 比较 `lastCommitTime`（Jun 8）与快照中的值 → 标记"更新"

### 修复
将最可靠的 `"defaultBranch":"..."` JSON 策略从策略3 提前到策略2，在 `css-truncate-target` span 策略之前执行。

### 涉及文件
- `src/services/github-scraper.ts` — `extractDefaultBranch()`

### 状态
已修复（2026-06-30）。重构后的代码已采用正确优先级顺序。

---

## 2. `parseGitHubRepoPage` 中 `lastCommitTime` 可能为 null

### 现象
GitHub 爬取失败或数据不完整时，`lastCommitTime` 为 `null`。SiteTracker.vue 的 `getCodeUpdateTime` 静默回退到 `lastUpdateTime`，使用户看到表面正确的值，但 `compareWithSnapshot` 比较 `null !== 有效值` 为 `true`，误标"更新"。

### 修复
1. `parseGitHubRepoPage` 增加策略4（`datetime` 属性最终回退），确保 `lastCommitTime` 永不 null。
2. `compareWithSnapshot` 增加 `!= null` 守卫，仅当新旧值均非空且不同时才计为变化。
3. `getCodeUpdateTime` 移除从 `lastCommitTime` 到 `lastUpdateTime` 的静默回退，`lastCommitTime` 为空时直接显示 `-`。

### 涉及文件
- `src/services/github-scraper.ts` — `parseGitHubRepoPage()`
- `src/components/SiteTracker.vue` — `compareWithSnapshot()`, `getCodeUpdateTime()`

### 状态
已修复（2026-06-30）。

---

## 3. 虚拟 release 的 `published_at` 可能无值

### 现象
当 GitHub API 返回的 release 数据无 `published_at` 字段时，代码创建虚拟 release 并将其 `published_at` 设为 `webData.pushed_at`。但 `pushed_at` 之后会被 commit 页面数据覆盖，导致时间错位。

### 修复
虚拟 release 的 `published_at` 改为 `webData.updated_at || webData.pushed_at`，确保有值且排期合理。

### 涉及文件
- `src/services/github-scraper.ts` — `scrapeRepoPage()`

### 状态
已修复（2026-06-30）。

---

## 4. `compareWithSnapshot` 对 null/undefined 字段无容忍度

### 现象
某次抓取某字段为 `null` 而快照中为有效值时，`compareWithSnapshot` 认为有变化，标记"更新"徽章。

### 修复
比较每个字段时增加 `if (oldVal != null && newVal != null && oldVal !== newVal)` 守卫，仅当两侧均有值时比较，避免 null 触发假阳性。

### 涉及文件
- `src/components/SiteTracker.vue` — `compareWithSnapshot()`

### 状态
已修复（2026-06-30）。

---

## 5. 硬编码 `default_branch = 'main'` 导致非 main 分支仓库获取不到 commit

### 现象
默认分支为 `master` 的仓库（如 hsq1820/DanmuTV），使用硬编码 `main` 访问 commits 页面返回 404，导致 `lastCommitTime` 为 null。

### 修复
新增 `extractDefaultBranch` 方法从页面 HTML 检测实际默认分支，用于构造 commits URL。

### 涉及文件
- `src/services/github-scraper.ts` — `extractDefaultBranch()`, `scrapeRepoPage()`

### 状态
已修复（2026-06-30）。

---

## 6. 提交页抓取失败导致全站 429 级联

### 现象
新版本所有站点获取数据时全部报 429 错误，旧版本（3 周前）运行正常。即使使用 `--serial` 模式也无法避免。

### 根因
1. `scrapeRepoPage` 中提交页抓取失败时 `throw e`（重新抛出），而旧代码是 catch 后继续使用主页面数据
2. 抛出错误后 `withFallback` 跳到 API 策略，`resolvePackage` 中还有重复的 `fetchPackagesViaApi` 调用
3. 每个站点的总请求数从 ~3 次膨胀到 ~8 次，10 站点串行 = 60-80 次请求，超出 GitHub 未认证 60/h 限额

### 问题链
1. 主页抓取成功，提交页 429 失败
2. `throw e` → `withFallback` 跳到策略 2（API）
3. API 也可能已被耗尽配额 → 整个站点失败
4. 所有站点串联触发相同问题 → 全部 429

### 修复
1. 提交页失败时 catch 不再抛出，使用主页面已提取的数据继续（恢复旧代码行为）
2. `resolvePackage` 合并两个重复的 `fetchPackagesViaApi` 策略为一个
3. 提交信息获取改为多策略：主页 LatestCommit 区块 → Atom feed → API（按代价从低到高，成功即停）

### 涉及文件
- `src/services/github-scraper.ts` — `scrapeRepoPage()`, `fillCommitTime()`
- `src/services/api.ts` — `resolvePackage()`

### 状态
已修复（2026-07-10）。

---

## 7. `parseGitHubRepoPage` 从 HTML 提取的提交时间不准确

### 现象
Decohererk/DecoTV 最新提交为 Jun 30, 2026，但 `lastCommitTime` 解析为 `2026-06-08`（旧数据）。

### 根因
`parseGitHubRepoPage` 用 `COMMITTED_DATE_REGEX` 匹配 HTML 中任意位置的 `"committedDate":"..."` 字段，匹配到的是页面其他位置的旧提交数据，而非顶部 LatestCommit 区块中的最新提交。

### 修复
新增 `extractLatestCommitTime` 函数，通过 `data-testid="latest-commit"` 精确定位页面顶部最新提交区块，提取其中的 `datetime` 属性。主页提取失败时由 `fillCommitTime` 通过 Atom feed/API 兜底。

### 涉及文件
- `src/services/github-parse.ts` — `parseGitHubRepoPage()`, `extractLatestCommitTime()`

### 状态
已修复（2026-07-10）。

---

## 8. `fillCommitTime` 在 `pushed_at` 已有时跳过

### 现象
`parseGitHubRepoPage` 从 HTML 提取到旧的提交时间后，`fillCommitTime` 检查 `if (repoData.pushed_at) return` 直接跳过，Atom feed/API 中的最新数据从未被执行。

### 修复
`parseGitHubRepoPage` 中 `extractLatestCommitTime` 已能准确提取最新提交时间，`fillCommitTime` 恢复为 `if (repoData.pushed_at) return` 逻辑，避免不必要的额外请求。若主页提取失败（`pushed_at` 为 null），则依次尝试 Atom feed → API。

### 涉及文件
- `src/services/github-scraper.ts` — `fillCommitTime()`

### 状态
已修复（2026-07-10）。

---

## 9. `latestRelease.published_at` 被设为提交时间而非 release 发布时间

### 现象
Decohererk/DecoTV 的 release v1.5.0 实际发布时间为 2026-06-08，但界面显示为 2026-07-16（最新提交时间）。

### 根因
`parseGitHubRepoPage` 从 HTML 提取了 release 的 tag name，但没有提取其发布时间。`api.ts` 构造 `latestRelease` 时用 `webData.updated_at`（即提交时间）作为 `published_at`。网页抓取策略成功后，API 策略（能正确返回 `published_at`）被 `withFallback` 跳过。

### 修复
1. `ScrapedRepoData` 新增 `latest_release_time` 字段
2. `parseGitHubRepoPage` 从 release 链接附近的 `<relative-time datetime="...">` 提取实际发布时间（搜索窗口 2000 字符）
3. `api.ts` 优先使用 `latest_release_time`，回退到 `updated_at`/`pushed_at`

### 涉及文件
- `src/services/github-parse.ts` — `parseGitHubRepoPage()`
- `src/services/api.ts` — `getGitHubRepoInfo()`

### 状态
已修复（2026-07-17）。
