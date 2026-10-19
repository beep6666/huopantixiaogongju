import { DATASET_KEYS, normalizeDataset } from "./core.mjs";

const pad = (value) => String(value).padStart(2, "0");

function dateAtOffset(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function createDemoState() {
  const now = new Date();
  const snapshotAt = now.toISOString();
  const rawData = {
    product_performance: [
      { product_id: "SKU-001", product_name: "翅根桶", category: "小食桶", lifecycle: "regular", status: "active", sales_7d: 4800, sales_prev_7d: 4300, stock_qty: 5200, gross_margin_pct: 32, supply_status: "normal", allowed_regions: ["全国"], snapshot_at: snapshotAt },
      { product_id: "SKU-002", product_name: "双人经典餐", category: "套餐", lifecycle: "regular", status: "active", sales_7d: 3600, sales_prev_7d: 3700, stock_qty: 4100, gross_margin_pct: 28, supply_status: "normal", allowed_regions: ["全国"], snapshot_at: snapshotAt },
      { product_id: "SKU-003", product_name: "新品芝士堡", category: "汉堡", lifecycle: "new", status: "active", sales_7d: 1200, sales_prev_7d: 640, stock_qty: 2600, gross_margin_pct: 40, supply_status: "normal", allowed_regions: ["全国"], snapshot_at: snapshotAt },
      { product_id: "SKU-004", product_name: "鸡块小食盒", category: "小食", lifecycle: "regular", status: "active", sales_7d: 1800, sales_prev_7d: 1850, stock_qty: 240, gross_margin_pct: 35, supply_status: "tight", allowed_regions: ["全国"], snapshot_at: snapshotAt },
      { product_id: "SKU-005", product_name: "旧版烤翅桶", category: "小食桶", lifecycle: "phase_out", status: "stopped", sales_7d: 0, sales_prev_7d: 210, stock_qty: 90, gross_margin_pct: 0, supply_status: "stopped", allowed_regions: ["全国"], snapshot_at: snapshotAt },
      { product_id: "SKU-006", product_name: "华南限定早餐卷", category: "早餐", lifecycle: "regular", status: "active", sales_7d: 700, sales_prev_7d: 720, stock_qty: 1500, gross_margin_pct: 24, supply_status: "normal", allowed_regions: ["华南"], snapshot_at: snapshotAt },
      { product_id: "SKU-007", product_name: "临期薯条桶", category: "小食桶", lifecycle: "clearance", status: "active", sales_7d: 600, sales_prev_7d: 880, stock_qty: 6800, gross_margin_pct: 12, supply_status: "normal", allowed_regions: ["全国"], snapshot_at: snapshotAt },
      { product_id: "SKU-008", product_name: "饮品随心杯", category: "饮品", lifecycle: "regular", status: "active", sales_7d: 2200, sales_prev_7d: 1900, stock_qty: 7200, gross_margin_pct: 45, supply_status: "normal", allowed_regions: ["全国"], snapshot_at: snapshotAt }
    ],
    product_channel_states: channelRows(snapshotAt),
    resource_slots: [
      { slot_id: "SLOT-MP-01", slot_name: "首页 Banner", channel_id: "miniapp", channel_name: "小程序", region: "华东", current_product_id: "SKU-002", adjustability: "adjustable", lock_reason: "", available_from: dateAtOffset(1), impressions_7d: 120000, clicks_7d: 9720, conversions_7d: 408, owner: "小程序运营-李", snapshot_at: snapshotAt },
      { slot_id: "SLOT-MP-02", slot_name: "首页商品坑位 1", channel_id: "miniapp", channel_name: "小程序", region: "华东", current_product_id: "SKU-001", adjustability: "adjustable", lock_reason: "", available_from: dateAtOffset(1), impressions_7d: 80000, clicks_7d: 5120, conversions_7d: 200, owner: "小程序运营-李", snapshot_at: snapshotAt },
      { slot_id: "SLOT-MP-03", slot_name: "新品专属位", channel_id: "miniapp", channel_name: "小程序", region: "华东", current_product_id: "SKU-003", adjustability: "locked", lock_reason: "新品推广项目保护", available_from: dateAtOffset(8), impressions_7d: 50000, clicks_7d: 4600, conversions_7d: 276, owner: "商品运营-陈", snapshot_at: snapshotAt },
      { slot_id: "SLOT-GB-01", slot_name: "POI 主推套餐位", channel_id: "groupbuy", channel_name: "团购", region: "华东", current_product_id: "SKU-002", adjustability: "adjustable", lock_reason: "", available_from: dateAtOffset(2), impressions_7d: 60000, clicks_7d: 3300, conversions_7d: 116, owner: "团购运营-赵", snapshot_at: snapshotAt },
      { slot_id: "SLOT-GB-02", slot_name: "直播间主推位", channel_id: "groupbuy", channel_name: "团购", region: "华东", current_product_id: "SKU-002", adjustability: "locked", lock_reason: "周末直播活动占用", available_from: dateAtOffset(5), impressions_7d: 200000, clicks_7d: 24000, conversions_7d: 1224, owner: "团购运营-赵", snapshot_at: snapshotAt },
      { slot_id: "SLOT-DL-01", slot_name: "频道推荐位", channel_id: "delivery", channel_name: "外卖", region: "华东", current_product_id: "SKU-001", adjustability: "adjustable", lock_reason: "", available_from: dateAtOffset(2), impressions_7d: 90000, clicks_7d: 6300, conversions_7d: 239, owner: "外卖运营-孙", snapshot_at: snapshotAt }
    ],
    business_projects: [
      { project_id: "PROJ-001", project_name: "新品芝士堡推广周", project_type: "launch", product_ids: ["SKU-003"], channel_ids: ["miniapp"], region: "华东", start_date: dateAtOffset(-3), end_date: dateAtOffset(8), locks_resource: true, locked_slot_ids: ["SLOT-MP-03"], owner: "商品运营-陈", snapshot_at: snapshotAt },
      { project_id: "PROJ-002", project_name: "周末团购直播", project_type: "marketing", product_ids: ["SKU-002"], channel_ids: ["groupbuy"], region: "华东", start_date: dateAtOffset(2), end_date: dateAtOffset(5), locks_resource: true, locked_slot_ids: ["SLOT-GB-02"], owner: "团购运营-赵", snapshot_at: snapshotAt },
      { project_id: "PROJ-003", project_name: "临期薯条桶清货", project_type: "clearance", product_ids: ["SKU-007"], channel_ids: ["miniapp", "delivery"], region: "华东", start_date: dateAtOffset(-2), end_date: dateAtOffset(7), locks_resource: false, locked_slot_ids: [], owner: "商品运营-陈", snapshot_at: snapshotAt }
    ],
    business_rules: [
      { rule_id: "RULE-001", rule_name: "停售商品不可用于经营动作", rule_type: "STOP_SALE", severity: "block", parameter: "", enabled: true, owner: "商品治理", valid_from: "", valid_to: "", snapshot_at: snapshotAt },
      { rule_id: "RULE-002", rule_name: "低库存不扩大曝光", rule_type: "LOW_STOCK", severity: "warn", parameter: "500", enabled: true, owner: "供应链", valid_from: "", valid_to: "", snapshot_at: snapshotAt },
      { rule_id: "RULE-003", rule_name: "区域不可售商品不可进入动作", rule_type: "REGION_SCOPE", severity: "block", parameter: "", enabled: true, owner: "商品治理", valid_from: "", valid_to: "", snapshot_at: snapshotAt },
      { rule_id: "RULE-004", rule_name: "渠道未上线需先确认", rule_type: "CHANNEL_OFFLINE", severity: "warn", parameter: "", enabled: true, owner: "渠道运营", valid_from: "", valid_to: "", snapshot_at: snapshotAt },
      { rule_id: "RULE-005", rule_name: "项目占用资源位需保护", rule_type: "PROJECT_LOCK", severity: "warn", parameter: "", enabled: true, owner: "项目管理", valid_from: "", valid_to: "", snapshot_at: snapshotAt },
      { rule_id: "RULE-006", rule_name: "新品保护期资源变更需确认", rule_type: "NEW_PRODUCT_PROTECTION", severity: "warn", parameter: "", enabled: true, owner: "商品运营", valid_from: "", valid_to: "", snapshot_at: snapshotAt },
      { rule_id: "RULE-007", rule_name: "清货任务需显式展示", rule_type: "CLEARANCE_VISIBILITY", severity: "info", parameter: "", enabled: true, owner: "供应链", valid_from: "", valid_to: "", snapshot_at: snapshotAt }
    ]
  };

  const data = {};
  for (const key of DATASET_KEYS) data[key] = normalizeDataset(key, rawData[key]).rows;
  const loads = Object.fromEntries(DATASET_KEYS.map((key) => [key, {
    loaded: true,
    source: "内置演示数据（非真实经营数据）",
    imported_at: now.toISOString(),
    row_count: data[key].length,
    mode: "demo"
  }]));

  return {
    version: 1,
    step: 1,
    mode: "demo",
    task: {
      id: "TASK-DEMO-001",
      name: "华东门店销量提升实验",
      objective: "华东门店未来 7 天整体销量 +8%",
      target_metric: "整体销量",
      target_delta_pct: 8,
      region: "华东",
      store_scope: "华东 120 家门店（演示口径）",
      store_count: 120,
      start_date: dateAtOffset(1),
      end_date: dateAtOffset(7),
      owner: "货盘负责人（演示）",
      protect_new: true,
      clearance_task: true,
      notes: "演示任务；真实实验必须替换任务范围与数据。",
      created_at: now.toISOString()
    },
    data,
    loads,
    importIssues: [],
    packetGeneratedAt: null,
    strategyActions: [],
    executionTasks: [],
    outcome: null,
    experiment: {},
    prepStartedAt: now.toISOString()
  };
}

function channelRows(snapshotAt) {
  const channels = [
    ["miniapp", "小程序"],
    ["groupbuy", "团购"],
    ["delivery", "外卖"]
  ];
  const products = ["SKU-001", "SKU-002", "SKU-003", "SKU-004", "SKU-005", "SKU-006", "SKU-007", "SKU-008"];
  const offline = new Set(["SKU-003|delivery", "SKU-006|miniapp", "SKU-006|groupbuy", "SKU-007|groupbuy", "SKU-008|delivery"]);
  const paused = new Set(["SKU-005|miniapp", "SKU-005|groupbuy", "SKU-005|delivery"]);
  return products.flatMap((productId, productIndex) => channels.map(([channelId, channelName], channelIndex) => {
    const key = `${productId}|${channelId}`;
    const status = paused.has(key) ? "paused" : offline.has(key) ? "offline" : "online";
    return {
      product_id: productId,
      channel_id: channelId,
      channel_name: channelName,
      listing_status: status,
      assortment_name: status === "online" ? `${channelName}常规货盘` : "",
      price: status === "online" ? 12.9 + productIndex * 2 + channelIndex : null,
      sales_7d: status === "online" ? Math.max(60, 900 - productIndex * 75 + channelIndex * 55) : 0,
      snapshot_at: snapshotAt
    };
  }));
}
