import { writeFileSync, readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import type { Site, SiteStatus } from "../src/types";
import { ApiService } from "../src/services/api";
import { withTimeout } from "../src/utils/retry";

async function fetchSiteData() {
  try {
    const configPath = join(process.cwd(), "config.json");
    const configContent = readFileSync(configPath, "utf-8");
    const config: { sites: Site[] } = JSON.parse(configContent);

    console.log(`开始获取 ${config.sites.length} 个网站的数据...`);

    // 逐个处理网站，避免一个卡住影响全部
    const siteStatuses: SiteStatus[] = [];

    for (let i = 0; i < config.sites.length; i++) {
      const site = config.sites[i];
      console.log(`\n[${i + 1}/${config.sites.length}] 正在获取: ${site.name}`);

      try {
        const siteStatus = await withTimeout(
          ApiService.getSiteStatus(site.name, site.url, site.desc, site.pkgname),
          30000 // 30秒超时
        );
        siteStatuses.push(siteStatus);
        console.log(`✅ ${site.name}: ${siteStatus.status}`);
      } catch (error: any) {
        console.log(`❌ ${site.name}: ${error.message}`);
        siteStatuses.push({
          name: site.name,
          url: site.url,
          desc: site.desc,
          type: "未知",
          status: "error",
          errorMessage: error.message,
        });
      }
    }

    const outputPath = join(process.cwd(), "public/data/sites.json");
    const outputData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalSites: siteStatuses.length,
        successCount: siteStatuses.filter((site) => site.status === "success").length,
        errorCount: siteStatuses.filter((site) => site.status === "error").length
      },
      sites: siteStatuses
    };
    
    // Ensure the directory exists before writing the file
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

    console.log(`\n📊 数据已保存到: ${outputPath}`);
    console.log(`📈 成功处理 ${siteStatuses.length} 个网站的状态信息`);

    const successCount = siteStatuses.filter((site) => site.status === "success").length;
    const errorCount = siteStatuses.filter((site) => site.status === "error").length;

    console.log(`✅ 成功: ${successCount} 个`);
    console.log(`❌ 失败: ${errorCount} 个`);

    console.log("\n📋 详细结果:");
    siteStatuses.forEach((site) => {
      const status = site.status === "success" ? "✅" : "❌";
      console.log(`${status} ${site.name}: ${site.status}`); 
      if (site.errorMessage) {
        console.log(`   错误: ${site.errorMessage}`);
      }
    });

    console.log("\n🎉 数据获取完成!");

    // 强制退出进程，避免延迟
    setTimeout(() => {
      process.exit(0);
    }, 100);
  } catch (error) {
    console.error("获取网站数据失败:", error);
    process.exit(1);
  }
}

fetchSiteData();