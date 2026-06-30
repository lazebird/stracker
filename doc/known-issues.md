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
