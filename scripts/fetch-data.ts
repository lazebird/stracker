import { writeFileSync, readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import type { Site, SiteStatus } from "../src/types";
import { ApiService } from "../src/services/api";
import { withTimeout } from "../src/utils/retry";

function fetchSite(site: Site): Promise<SiteStatus> {
  return withTimeout(
    ApiService.getSiteStatus(site.name, site.url, site.desc, site.pkgname),
    10000
  ).catch((error: Error): SiteStatus => ({
    name: site.name,
    url: site.url,
    desc: site.desc,
    type: "未知",
    status: "error" as const,
    errorMessage: error.message,
  }));
}

function saveResults(results: SiteStatus[], outputPath: string): void {
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
}

function printResults(results: SiteStatus[], outputPath: string): void {
  const successCount = results.filter((s) => s.status === "success").length;
  const errorCount = results.filter((s) => s.status === "error").length;

  console.log(`\n✅ 成功: ${successCount} 个`);
  if (errorCount > 0) {
    console.log(`❌ 失败: ${errorCount} 个`);
  }

  console.log("\n📋 详细结果:");
  results.forEach((result, i) => {
    const icon = result.status === "success" ? "✅" : "❌";
    console.log(`${i + 1}. ${icon} ${result.name}: ${result.status}`);
    if (result.errorMessage) {
      console.log(`   错误: ${result.errorMessage}`);
    }
  });

  console.log(`\n📊 数据已保存到: ${outputPath}`);
  console.log("🎉 数据获取完成!");
}

async function main() {
  try {
    const serial = process.argv.includes("--serial");
    const configPath = join(process.cwd(), "config.json");
    const configContent = readFileSync(configPath, "utf-8");
    const config: { sites: Site[] } = JSON.parse(configContent);

    console.log(`开始 ${serial ? '串行' : '并行'} 获取 ${config.sites.length} 个网站的数据...`);

    let results: SiteStatus[];
    if (serial) {
      results = [];
      for (const site of config.sites) {
        results.push(await fetchSite(site));
      }
    } else {
      results = await Promise.all(config.sites.map(fetchSite));
    }

    const outputPath = join(process.cwd(), "public/data/sites.json");
    saveResults(results, outputPath);
    printResults(results, outputPath);

    setTimeout(() => process.exit(0), 100);
  } catch (error) {
    console.error("获取网站数据失败:", error);
    process.exit(1);
  }
}

main();