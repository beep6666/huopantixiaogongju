import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDecisionPacket,
  buildExecutionTasks,
  computeOutcomeComparison,
  normalizeDataset,
  parseCsv,
  validateStrategyAction,
  validateWorkspace
} from "../src/core.mjs";
import { createDemoState } from "../src/demo.mjs";

test("CSV 解析支持 BOM、引号、逗号与转义引号", () => {
  const rows = parseCsv('\uFEFFproduct_id,product_name,note\r\nSKU-1,"套餐, A","含""引号"""\r\n');
  assert.deepEqual(rows, [{ product_id: "SKU-1", product_name: "套餐, A", note: '含"引号"' }]);
});

test("数据规范化显式报告必填、类型和枚举问题", () => {
  const result = normalizeDataset("product_performance", [{
    product_id: "SKU-X",
    product_name: "测试商品",
    lifecycle: "unknown",
    status: "active",
    sales_7d: "不是数字",
    sales_prev_7d: "10",
    stock_qty: "20",
    supply_status: "normal",
    allowed_regions: "华东|华南",
    snapshot_at: "2026-10-18T00:00:00+08:00"
  }]);
  assert.ok(result.issues.some((issue) => issue.code === "INVALID_ENUM"));
  assert.ok(result.issues.some((issue) => issue.code === "INVALID_TYPE"));
  assert.deepEqual(result.rows[0].allowed_regions, ["华东", "华南"]);
});

test("演示数据可以生成资料包且明确命中关键冲突", () => {
  const state = createDemoState();
  const validation = validateWorkspace(state);
  const packet = buildDecisionPacket(state);
  assert.equal(validation.filter((issue) => issue.level === "error").length, 0);
  assert.equal(packet.packetReady, true);
  assert.ok(packet.conflicts.some((item) => item.kind === "STOP_SALE" && item.productId === "SKU-005"));
  assert.ok(packet.conflicts.some((item) => item.kind === "LOW_STOCK" && item.productId === "SKU-004"));
  assert.ok(packet.conflicts.some((item) => item.kind === "REGION_SCOPE" && item.productId === "SKU-006"));
  assert.ok(packet.conflicts.some((item) => item.kind === "PROJECT_LOCK" && item.slotId === "SLOT-MP-03"));
});

test("跨表关联依赖稳定 ID，商品改名不会打断渠道矩阵", () => {
  const state = createDemoState();
  state.data.product_performance.find((row) => row.product_id === "SKU-001").product_name = "翅根桶·新名称";
  const packet = buildDecisionPacket(state);
  const matrixRow = packet.matrix.find((row) => row.product.product_id === "SKU-001");
  assert.equal(matrixRow.product.product_name, "翅根桶·新名称");
  assert.equal(matrixRow.cells.filter((cell) => cell.state).length, 3);
});

test("未知商品引用与重复主键会阻止资料包", () => {
  const state = createDemoState();
  state.data.product_channel_states.push({ ...state.data.product_channel_states[0] });
  state.data.product_channel_states.push({ ...state.data.product_channel_states[0], product_id: "MISSING", channel_id: "other", channel_name: "其他" });
  const validation = validateWorkspace(state);
  assert.ok(validation.some((issue) => issue.code === "DUPLICATE_KEY" && issue.level === "error"));
  assert.ok(validation.some((issue) => issue.code === "UNKNOWN_PRODUCT" && issue.level === "error"));
});

test("人工策略不会绕过停售阻断，正常动作可转为执行任务", () => {
  const state = createDemoState();
  const packet = buildDecisionPacket(state);
  const blockedAction = { id: "A1", product_id: "SKU-005", channel_id: "miniapp", slot_id: "", action_text: "扩大曝光", rationale: "人工测试" };
  assert.ok(validateStrategyAction(blockedAction, state, packet).some((issue) => issue.level === "error"));

  const action = { id: "A2", product_id: "SKU-001", channel_id: "miniapp", slot_id: "SLOT-MP-02", action_text: "保持并强化展示", rationale: "销量上升且库存充足", owner: "运营-李", deadline: state.task.end_date };
  assert.equal(validateStrategyAction(action, state, packet).filter((issue) => issue.level === "error").length, 0);
  const execution = buildExecutionTasks([action], state);
  assert.equal(execution.length, 1);
  assert.equal(execution[0].strategy_action_id, "A2");
  assert.match(execution[0].task_text, /翅根桶/);
});

test("结果回收只计算描述性前后变化", () => {
  const rows = computeOutcomeComparison({
    overall_before: 100,
    overall_after: 108,
    selected_before: 20,
    selected_after: 25,
    other_before: 80,
    other_after: 83
  });
  assert.equal(rows[0].change_pct, 8);
  assert.equal(rows[1].change_pct, 25);
  assert.equal(rows[2].change_pct, 3.75);
  assert.equal(Object.hasOwn(rows[0], "causal_effect"), false);
});
