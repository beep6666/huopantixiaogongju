import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("入口页面引用本地样式与模块，且没有重复 ID", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /\.\/styles\.css/);
  assert.match(html, /\.\/src\/app\.js/);
  assert.doesNotMatch(html, /https?:\/\//);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test("前端实现包含完整六步与非因果提示", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  for (const phrase of ["创建经营任务", "装载决策数据", "决策资料包", "人工形成策略", "执行清单", "结果与实验反馈"]) {
    assert.match(app, new RegExp(phrase));
  }
  assert.match(app, /禁止因果解读/);
  assert.match(app, /未上传是“未知”/);
});
