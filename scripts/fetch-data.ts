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

    // 并行发送所有请求，每个独立超时，各自处理错误不互相影响
    const results = await Promise.all(
      config.sites.map((site) =>
        withTimeout(
          ApiService.getSiteStatus(site.name, site.url, site.desc, site.pkgname),
          10000
        ).catch((error: Error): SiteStatus => ({
          name: site.name,
          url: site.url,
          desc: site.desc,
          type: "未知",
          status: "error" as const,
          errorMessage: error.message,
        }))
      )
    );

    const outputPath = join(process.cwd(), "public/data/sites.json");
    const successCount = results.filter((s) => s.status === "success").length;
    const errorCount = results.filter((s) => s.status === "error").length;
    const outputData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalSites: results.length,
        successCount,
        errorCount,
      },
      sites: results,
    };

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

    console.log(`\n✅ 成功: ${successCount} 个`);
    if (errorCount > 0) {
      console.log(`❌ 失败: ${errorCount} 个`);
    }

    console.log("\n📋 详细结果:");
    results.forEach((site, i) => {
      const icon = site.status === "success" ? "✅" : "❌";
      console.log(`${i + 1}. ${icon} ${site.name}: ${site.status}`);
      if (site.errorMessage) {
        console.log(`   错误: ${site.errorMessage}`);
      }
    });

    console.log(`\n📊 数据已保存到: ${outputPath}`);
    console.log("🎉 数据获取完成!");

    setTimeout(() => {
      process.exit(0);
    }, 100);
  } catch (error) {
    console.error("获取网站数据失败:", error);
    process.exit(1);
  }
}

fetchSiteData();