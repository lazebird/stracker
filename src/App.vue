<template>
  <div id="app">
    <header>
      <h1><a href="https://github.com/lazebird/stracker" target="_blank">网站/项目状态跟踪系统</a></h1>
    </header>
    <main>
      <SiteTracker />
    </main>
  </div>
</template>

<script setup lang="ts">
import SiteTracker from "./components/SiteTracker.vue";
</script>

<style>
#app {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

header {
  text-align: center;
  margin-bottom: 40px;
}

h1 {
  color: #2c3e50;
  font-size: 2.5rem;
  margin-bottom: 10px;
}
</style>
