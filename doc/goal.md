# 需求/目标
- 实现一个网站/项目状态批量跟踪系统
- 给定网站数据，通过github workflow定期更新网站信息，并通过github pages呈现出来
- 首批支持：
  - github项目 最近代码提交时间跟踪，和最新版本发布信息跟踪
  - github docker镜像 最新版本发布信息跟踪
  - docker hub镜像 最新版本发布信息跟踪

# 技术栈
- 采用vue+vite+typescript开发，pnpm管理

# TODO
- [ ] 项目框架搭建
- [ ] 基于github/docker等网站的API接口或者cURL方式，实现数据获取接口
- [ ] 基于config.json中的sites数据，识别网站类型，调用对应数据获取接口，生成网站跟踪数据表
- [ ] 基于github pages将数据表发布到静态页面
- [ ] 实现workflow脚本，每天运行网站数据更新


