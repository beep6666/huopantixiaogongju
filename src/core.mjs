export const DATASET_CONFIG = {
  product_performance: {
    label: "商品表现",
    requiredForPacket: true,
    freshnessHours: 48,
    key: ["product_id"],
    fields: [
      field("product_id", "商品 ID", "string", true),
      field("product_name", "商品名称", "string", true),
      field("category", "分类", "string", false),
      field("lifecycle", "生命周期", "string", true, ["new", "regular", "clearance", "phase_out"]),
      field("status", "销售状态", "string", true, ["active", "stopped", "out_of_stock"]),
      field("sales_7d", "近 7 日销量", "number", true),
      field("sales_prev_7d", "前 7 日销量", "number", true),
      field("stock_qty", "可售库存", "number", true),
      field("gross_margin_pct", "毛利率", "number", false),
      field("supply_status", "供应状态", "string", true, ["normal", "tight", "stopped"]),
      field("allowed_regions", "可售区域", "list", true),
      field("snapshot_at", "快照时间", "datetime", true)
    ]
  },
  product_channel_states: {
    label: "商品 × 渠道状态",
    requiredForPacket: true,
    freshnessHours: 48,
    key: ["product_id", "channel_id"],
    fields: [
      field("product_id", "商品 ID", "string", true),
      field("channel_id", "渠道 ID", "string", true),
      field("channel_name", "渠道名称", "string", true),
      field("listing_status", "上线状态", "string", true, ["online", "offline", "pending", "paused"]),
      field("assortment_name", "当前货盘", "string", false),
      field("price", "当前价格", "number", false),
      field("sales_7d", "渠道近 7 日销量", "number", false),
      field("snapshot_at", "快照时间", "datetime", true)
    ]
  },
  resource_slots: {
    label: "资源位",
    requiredForPacket: true,
    freshnessHours: 48,
    key: ["slot_id"],
    fields: [
      field("slot_id", "资源位 ID", "string", true),
      field("slot_name", "资源位名称", "string", true),
      field("channel_id", "渠道 ID", "string", true),
      field("channel_name", "渠道名称", "string", true),
      field("region", "区域", "string", true),
      field("current_product_id", "当前商品 ID", "string", false),
      field("adjustability", "可调整状态", "string", true, ["adjustable", "locked", "unavailable"]),
      field("lock_reason", "锁定原因", "string", false),
      field("available_from", "最早可调整时间", "date", false),
      field("impressions_7d", "近 7 日曝光", "number", false),
      field("clicks_7d", "近 7 日点击", "number", false),
      field("conversions_7d", "近 7 日转化", "number", false),
      field("owner", "Owner", "string", false),
      field("snapshot_at", "快照时间", "datetime", true)
    ]
  },
  business_projects: {
    label: "当前业务项目",
    requiredForPacket: false,
    freshnessHours: 168,
    key: ["project_id"],
    fields: [
      field("project_id", "项目 ID", "string", true),
      field("project_name", "项目名称", "string", true),
      field("project_type", "项目类型", "string", true, ["launch", "clearance", "marketing", "regional"]),
      field("product_ids", "关联商品 ID", "list", false),
      field("channel_ids", "关联渠道 ID", "list", false),
      field("region", "区域", "string", true),
      field("start_date", "开始日期", "date", true),
      field("end_date", "结束日期", "date", true),
      field("locks_resource", "是否锁资源", "boolean", true),
      field("locked_slot_ids", "锁定资源位 ID", "list", false),
      field("owner", "Owner", "string", false),
      field("snapshot_at", "快照时间", "datetime", true)
    ]
  },
  business_rules: {
    label: "业务规则",
    requiredForPacket: false,
    freshnessHours: 168,
    key: ["rule_id"],
    fields: [
      field("rule_id", "规则 ID", "string", true),
      field("rule_name", "规则名称", "string", true),
      field("rule_type", "规则类型", "string", true, [
        "STOP_SALE",
        "LOW_STOCK",
        "REGION_SCOPE",
        "CHANNEL_OFFLINE",
        "PROJECT_LOCK",
        "NEW_PRODUCT_PROTECTION",
        "CLEARANCE_VISIBILITY"
      ]),
      field("severity", "级别", "string", true, ["block", "warn", "info"]),
      field("parameter", "参数", "string", false),
      field("enabled", "是否启用", "boolean", true),
      field("owner", "规则 Owner", "string", true),
      field("valid_from", "生效日期", "date", false),
      field("valid_to", "失效日期", "date", false),
      field("snapshot_at", "快照时间", "datetime", true)
    ]
  }
};

export const DATASET_KEYS = Object.keys(DATASET_CONFIG);

function field(name, label, type, required, values = null) {
  return { name, label, type, required, values };
}

export function emptyData() {
  return Object.fromEntries(DATASET_KEYS.map((key) => [key, []]));
}

export function templateCsv(datasetKey) {
  const config = DATASET_CONFIG[datasetKey];
  if (!config) throw new Error(`未知数据集：${datasetKey}`);
  return `${config.fields.map((item) => item.name).join(",")}\r\n`;
}

export function parseCsv(text) {
  const source = String(text ?? "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (character === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("CSV 中存在未闭合的引号");
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  if (!rows.length) return [];

  const headers = rows.shift().map((value) => value.trim());
  if (new Set(headers).size !== headers.length) throw new Error("CSV 表头存在重复字段");
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

export function toCsv(rows, headers = null) {
  const columns = headers || [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const encode = (value) => {
    const normalized = Array.isArray(value) ? value.join("|") : String(value ?? "");
    return /[",\n\r]/.test(normalized) ? `"${normalized.replaceAll('"', '""')}"` : normalized;
  };
  return `${columns.map(encode).join(",")}\r\n${rows.map((row) => columns.map((column) => encode(row[column])).join(",")).join("\r\n")}`;
}

export function normalizeDataset(datasetKey, rawRows) {
  const config = DATASET_CONFIG[datasetKey];
  if (!config) throw new Error(`未知数据集：${datasetKey}`);
  if (!Array.isArray(rawRows)) throw new Error(`${config.label} 必须是数组`);
  const issues = [];
  const rows = rawRows.map((rawRow, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const normalized = {};
    for (const descriptor of config.fields) {
      const rawValue = rawRow?.[descriptor.name];
      if (descriptor.required && isBlank(rawValue)) {
        issues.push(issue("error", "REQUIRED_FIELD", datasetKey, rowNumber, `${descriptor.label}（${descriptor.name}）不能为空`));
        normalized[descriptor.name] = null;
        continue;
      }
      const parsed = coerceValue(rawValue, descriptor.type);
      if (!isBlank(rawValue) && parsed.invalid) {
        issues.push(issue("error", "INVALID_TYPE", datasetKey, rowNumber, `${descriptor.label}（${descriptor.name}）格式错误`));
        normalized[descriptor.name] = null;
        continue;
      }
      normalized[descriptor.name] = parsed.value;
      if (descriptor.values && !isBlank(parsed.value) && !descriptor.values.includes(parsed.value)) {
        issues.push(issue("error", "INVALID_ENUM", datasetKey, rowNumber, `${descriptor.label}只支持：${descriptor.values.join(" / ")}`));
      }
    }
    return normalized;
  });
  return { rows, issues };
}

function isBlank(value) {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function coerceValue(rawValue, type) {
  if (isBlank(rawValue)) return { value: type === "list" ? [] : null, invalid: false };
  if (type === "string" || type === "date" || type === "datetime") return { value: String(rawValue).trim(), invalid: false };
  if (type === "number") {
    const number = typeof rawValue === "number" ? rawValue : Number(String(rawValue).replaceAll(",", "").trim());
    return { value: number, invalid: !Number.isFinite(number) };
  }
  if (type === "boolean") {
    if (typeof rawValue === "boolean") return { value: rawValue, invalid: false };
    const value = String(rawValue).trim().toLowerCase();
    if (["true", "1", "yes", "y", "是"].includes(value)) return { value: true, invalid: false };
    if (["false", "0", "no", "n", "否"].includes(value)) return { value: false, invalid: false };
    return { value: null, invalid: true };
  }
  if (type === "list") {
    if (Array.isArray(rawValue)) return { value: rawValue.map(String).map((value) => value.trim()).filter(Boolean), invalid: false };
    return { value: String(rawValue).split(/[|；;]/).map((value) => value.trim()).filter(Boolean), invalid: false };
  }
  return { value: rawValue, invalid: false };
}

export function validateWorkspace(state, now = new Date()) {
  const issues = [];
  if (!state.task) {
    issues.push(issue("error", "TASK_MISSING", "task", null, "尚未创建经营任务"));
  } else {
    if (!state.task.name || !state.task.objective || !state.task.region) {
      issues.push(issue("error", "TASK_INCOMPLETE", "task", null, "经营任务名称、目标和区域不能为空"));
    }
    if (!validDate(state.task.start_date) || !validDate(state.task.end_date) || new Date(state.task.start_date) > new Date(state.task.end_date)) {
      issues.push(issue("error", "TASK_DATE", "task", null, "经营任务开始/结束日期无效"));
    }
  }

  for (const datasetKey of DATASET_KEYS) {
    const config = DATASET_CONFIG[datasetKey];
    const rows = state.data?.[datasetKey] || [];
    const loaded = Boolean(state.loads?.[datasetKey]?.loaded);
    if (!loaded) {
      issues.push(issue(config.requiredForPacket ? "error" : "warning", "DATASET_MISSING", datasetKey, null, `${config.label}尚未导入`));
      continue;
    }
    if (config.requiredForPacket && !rows.length) {
      issues.push(issue("error", "DATASET_EMPTY", datasetKey, null, `${config.label}没有数据行`));
    }
    const normalized = normalizeDataset(datasetKey, rows);
    issues.push(...normalized.issues);
    const seen = new Set();
    for (const [index, row] of rows.entries()) {
      const compositeKey = config.key.map((key) => row[key]).join("::");
      if (seen.has(compositeKey)) {
        issues.push(issue("error", "DUPLICATE_KEY", datasetKey, index + 2, `主键重复：${compositeKey}`));
      }
      seen.add(compositeKey);
    }
    const staleRows = rows.filter((row) => row.snapshot_at && ageHours(row.snapshot_at, now) > config.freshnessHours);
    const invalidSnapshotRows = rows.filter((row) => row.snapshot_at && !validDate(row.snapshot_at));
    if (staleRows.length) {
      issues.push(issue("warning", "STALE_DATA", datasetKey, null, `${config.label}有 ${staleRows.length} 行超过 ${config.freshnessHours} 小时未更新`));
    }
    if (invalidSnapshotRows.length) {
      issues.push(issue("error", "INVALID_SNAPSHOT", datasetKey, null, `${config.label}有 ${invalidSnapshotRows.length} 行快照时间不可识别`));
    }
  }

  const products = new Set((state.data?.product_performance || []).map((row) => row.product_id));
  const channelStates = state.data?.product_channel_states || [];
  for (const [index, row] of channelStates.entries()) {
    if (row.product_id && !products.has(row.product_id)) {
      issues.push(issue("error", "UNKNOWN_PRODUCT", "product_channel_states", index + 2, `商品 ${row.product_id} 在商品表现表中不存在`));
    }
  }

  const slots = new Set((state.data?.resource_slots || []).map((row) => row.slot_id));
  for (const [index, row] of (state.data?.resource_slots || []).entries()) {
    if (row.current_product_id && !products.has(row.current_product_id)) {
      issues.push(issue("warning", "UNKNOWN_CURRENT_PRODUCT", "resource_slots", index + 2, `当前商品 ${row.current_product_id} 无法关联商品表现表`));
    }
    if (row.adjustability === "locked" && !row.lock_reason) {
      issues.push(issue("warning", "LOCK_REASON_MISSING", "resource_slots", index + 2, `资源位 ${row.slot_id} 已锁定但没有锁定原因`));
    }
  }

  for (const [index, project] of (state.data?.business_projects || []).entries()) {
    for (const productId of project.product_ids || []) {
      if (!products.has(productId)) issues.push(issue("warning", "UNKNOWN_PROJECT_PRODUCT", "business_projects", index + 2, `项目关联商品 ${productId} 不存在`));
    }
    for (const slotId of project.locked_slot_ids || []) {
      if (!slots.has(slotId)) issues.push(issue("warning", "UNKNOWN_PROJECT_SLOT", "business_projects", index + 2, `项目锁定资源位 ${slotId} 不存在`));
    }
  }

  const channelNames = new Map();
  for (const row of channelStates) {
    if (!channelNames.has(row.channel_id)) channelNames.set(row.channel_id, row.channel_name);
    else if (channelNames.get(row.channel_id) !== row.channel_name) {
      issues.push(issue("warning", "CHANNEL_NAME_CONFLICT", "product_channel_states", null, `渠道 ${row.channel_id} 出现多个名称`));
    }
  }
  return deduplicateIssues(issues);
}

function issue(level, code, dataset, row, message) {
  return { level, code, dataset, row, message };
}

function deduplicateIssues(issues) {
  const seen = new Set();
  return issues.filter((item) => {
    const key = `${item.level}|${item.code}|${item.dataset}|${item.row}|${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validDate(value) {
  return value && Number.isFinite(new Date(value).getTime());
}

function ageHours(value, now) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? (now.getTime() - timestamp) / 3_600_000 : Number.POSITIVE_INFINITY;
}

function isRuleActive(rule, date) {
  if (!rule.enabled) return false;
  const current = dateOnly(date);
  if (rule.valid_from && current < rule.valid_from) return false;
  if (rule.valid_to && current > rule.valid_to) return false;
  return true;
}

function dateOnly(date) {
  const value = date instanceof Date ? date : new Date(date);
  return value.toISOString().slice(0, 10);
}

function overlaps(startA, endA, startB, endB) {
  return startA <= endB && startB <= endA;
}

function regionMatches(allowedRegions, taskRegion) {
  const regions = allowedRegions || [];
  return regions.includes("全国") || regions.includes("all") || regions.includes(taskRegion);
}

export function buildDecisionPacket(state, now = new Date()) {
  const validation = validateWorkspace(state, now);
  const products = state.data.product_performance || [];
  const channelStates = state.data.product_channel_states || [];
  const slots = state.data.resource_slots || [];
  const projects = state.data.business_projects || [];
  const task = state.task;
  const ruleRows = (state.data.business_rules || []).filter((rule) => isRuleActive(rule, now));
  const rulesByType = Object.groupBy ? Object.groupBy(ruleRows, (rule) => rule.rule_type) : groupBy(ruleRows, (rule) => rule.rule_type);
  const conflicts = [];
  const addConflict = (conflict) => conflicts.push({ id: `${conflict.ruleId || conflict.kind}-${conflicts.length + 1}`, ...conflict });
  const rule = (type) => rulesByType[type]?.[0] || null;

  if (task) {
    for (const product of products) {
      const stopRule = rule("STOP_SALE");
      if (stopRule && ["stopped", "phase_out"].includes(product.status === "stopped" ? "stopped" : product.lifecycle)) {
        addConflict({ severity: stopRule.severity, kind: "STOP_SALE", ruleId: stopRule.rule_id, productId: product.product_id, title: `${product.product_name} 不可继续推荐`, detail: "商品状态为停售或待下架。", evidence: `status=${product.status}, lifecycle=${product.lifecycle}`, source: stopRule.rule_name });
      }
      const stockRule = rule("LOW_STOCK");
      const stockThreshold = Number(stockRule?.parameter || 0);
      if (stockRule && Number.isFinite(product.stock_qty) && product.stock_qty < stockThreshold) {
        addConflict({ severity: stockRule.severity, kind: "LOW_STOCK", ruleId: stockRule.rule_id, productId: product.product_id, title: `${product.product_name} 库存低于扩量阈值`, detail: `当前可售库存 ${product.stock_qty}，规则阈值 ${stockThreshold}。`, evidence: `stock_qty=${product.stock_qty}`, source: stockRule.rule_name });
      }
      const regionRule = rule("REGION_SCOPE");
      if (regionRule && !regionMatches(product.allowed_regions, task.region)) {
        addConflict({ severity: regionRule.severity, kind: "REGION_SCOPE", ruleId: regionRule.rule_id, productId: product.product_id, title: `${product.product_name} 不在任务区域可售范围`, detail: `任务区域为 ${task.region}，商品可售区域为 ${(product.allowed_regions || []).join(" / ") || "未填写"}。`, evidence: `allowed_regions=${(product.allowed_regions || []).join("|")}`, source: regionRule.rule_name });
      }
      const newRule = rule("NEW_PRODUCT_PROTECTION");
      if (newRule && task.protect_new && product.lifecycle === "new") {
        addConflict({ severity: newRule.severity, kind: "NEW_PRODUCT_PROTECTION", ruleId: newRule.rule_id, productId: product.product_id, title: `${product.product_name} 处于新品保护范围`, detail: "任务要求保护新品，涉及资源变更时需要人工确认。", evidence: "lifecycle=new, task.protect_new=true", source: newRule.rule_name });
      }
      const clearanceRule = rule("CLEARANCE_VISIBILITY");
      if (clearanceRule && (product.lifecycle === "clearance" || task.clearance_task)) {
        const related = projects.some((project) => project.project_type === "clearance" && (project.product_ids || []).includes(product.product_id));
        if (product.lifecycle === "clearance" || related) {
          addConflict({ severity: clearanceRule.severity, kind: "CLEARANCE_VISIBILITY", ruleId: clearanceRule.rule_id, productId: product.product_id, title: `${product.product_name} 关联清货任务`, detail: "这是业务优先级提示，不代表系统建议选用。", evidence: `lifecycle=${product.lifecycle}`, source: clearanceRule.rule_name });
        }
      }
    }

    const offlineRule = rule("CHANNEL_OFFLINE");
    if (offlineRule) {
      for (const row of channelStates.filter((item) => item.listing_status !== "online")) {
        const product = products.find((item) => item.product_id === row.product_id);
        addConflict({ severity: offlineRule.severity, kind: "CHANNEL_OFFLINE", ruleId: offlineRule.rule_id, productId: row.product_id, channelId: row.channel_id, title: `${product?.product_name || row.product_id} 在${row.channel_name}未可售`, detail: `当前状态：${row.listing_status}。`, evidence: `listing_status=${row.listing_status}`, source: offlineRule.rule_name });
      }
    }

    const projectRule = rule("PROJECT_LOCK");
    if (projectRule) {
      for (const project of projects) {
        const active = overlaps(project.start_date, project.end_date, task.start_date, task.end_date);
        const regionHit = ["全国", "all", task.region].includes(project.region);
        if (!project.locks_resource || !active || !regionHit) continue;
        for (const slotId of project.locked_slot_ids || []) {
          const slot = slots.find((item) => item.slot_id === slotId);
          addConflict({ severity: projectRule.severity, kind: "PROJECT_LOCK", ruleId: projectRule.rule_id, slotId, channelId: slot?.channel_id, productId: project.product_ids?.[0], title: `${slot?.slot_name || slotId} 被业务项目占用`, detail: `${project.project_name} 与任务周期重叠（${project.start_date} 至 ${project.end_date}）。`, evidence: `project_id=${project.project_id}`, source: projectRule.rule_name });
        }
      }
    }
  }

  const channels = [...new Map([
    ...channelStates.map((row) => [row.channel_id, { channel_id: row.channel_id, channel_name: row.channel_name }]),
    ...slots.map((row) => [row.channel_id, { channel_id: row.channel_id, channel_name: row.channel_name }])
  ]).values()].sort((a, b) => a.channel_id.localeCompare(b.channel_id, "zh-CN"));

  const matrix = products.map((product) => ({
    product,
    cells: channels.map((channel) => {
      const stateRow = channelStates.find((row) => row.product_id === product.product_id && row.channel_id === channel.channel_id);
      return { channel, state: stateRow || null, status: stateRow?.listing_status || "unknown" };
    })
  }));

  const attentionProducts = products.map((product) => {
    const relatedConflicts = conflicts.filter((item) => item.productId === product.product_id);
    const trendPct = product.sales_prev_7d > 0 ? ((product.sales_7d - product.sales_prev_7d) / product.sales_prev_7d) * 100 : null;
    const signal = [];
    if (product.lifecycle === "new") signal.push("新品");
    if (product.lifecycle === "clearance") signal.push("清货");
    if (trendPct !== null && Math.abs(trendPct) >= 10) signal.push(`销量${trendPct > 0 ? "上升" : "下降"} ${Math.abs(trendPct).toFixed(1)}%`);
    if (!signal.length) signal.push("表现相对稳定");
    const level = relatedConflicts.some((item) => item.severity === "block") ? "block" : relatedConflicts.some((item) => item.severity === "warn") ? "warn" : "clear";
    return { ...product, trend_pct: trendPct, signal, conflicts: relatedConflicts, level };
  }).sort((a, b) => levelScore(b.level) - levelScore(a.level) || Math.abs(b.trend_pct || 0) - Math.abs(a.trend_pct || 0));

  return {
    generatedAt: now.toISOString(),
    validation,
    conflicts: deduplicateConflicts(conflicts),
    attentionProducts,
    channels,
    matrix,
    adjustableSlots: slots.filter((slot) => slot.adjustability === "adjustable"),
    lockedSlots: slots.filter((slot) => slot.adjustability !== "adjustable"),
    channelGaps: channelStates.filter((row) => row.listing_status !== "online"),
    unknownMatrixCells: matrix.flatMap((row) => row.cells).filter((cell) => cell.status === "unknown").length,
    activeProjects: task ? projects.filter((project) => overlaps(project.start_date, project.end_date, task.start_date, task.end_date)) : [],
    packetReady: !validation.some((item) => item.level === "error")
  };
}

function groupBy(rows, getter) {
  return rows.reduce((result, row) => {
    const key = getter(row);
    (result[key] ||= []).push(row);
    return result;
  }, {});
}

function deduplicateConflicts(conflicts) {
  const seen = new Set();
  return conflicts.filter((conflict) => {
    const key = `${conflict.kind}|${conflict.productId || ""}|${conflict.channelId || ""}|${conflict.slotId || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function levelScore(level) {
  return { block: 3, warn: 2, clear: 1 }[level] || 0;
}

export function validateStrategyAction(action, state, packet = buildDecisionPacket(state)) {
  const issues = [];
  const product = state.data.product_performance.find((row) => row.product_id === action.product_id);
  const channel = state.data.product_channel_states.find((row) => row.product_id === action.product_id && row.channel_id === action.channel_id);
  const slot = action.slot_id ? state.data.resource_slots.find((row) => row.slot_id === action.slot_id) : null;
  if (!product) issues.push({ level: "error", message: "请选择有效商品" });
  if (!action.channel_id) issues.push({ level: "error", message: "请选择渠道" });
  if (!action.action_text?.trim()) issues.push({ level: "error", message: "请填写动作" });
  if (!action.rationale?.trim()) issues.push({ level: "error", message: "请填写人工判断依据" });
  if (channel && channel.listing_status !== "online") issues.push({ level: "warning", message: `该商品在渠道中状态为 ${channel.listing_status}` });
  if (!channel && product && action.channel_id) issues.push({ level: "warning", message: "缺少该商品 × 渠道状态，不能确认是否可执行" });
  if (slot) {
    if (slot.channel_id !== action.channel_id) issues.push({ level: "warning", message: "资源位与所选渠道不一致" });
    if (slot.adjustability !== "adjustable") issues.push({ level: "warning", message: `资源位当前为 ${slot.adjustability}` });
  } else if (action.slot_id) {
    issues.push({ level: "error", message: "所选资源位不存在" });
  }
  const related = packet.conflicts.filter((conflict) => conflict.productId === action.product_id || (action.slot_id && conflict.slotId === action.slot_id));
  for (const conflict of related) issues.push({ level: conflict.severity === "block" ? "error" : "warning", message: conflict.title });
  return deduplicateActionIssues(issues);
}

function deduplicateActionIssues(issues) {
  const seen = new Set();
  return issues.filter((item) => !seen.has(item.message) && seen.add(item.message));
}

export function buildExecutionTasks(actions, state, existingTasks = []) {
  const products = new Map(state.data.product_performance.map((row) => [row.product_id, row.product_name]));
  const channels = new Map(state.data.product_channel_states.map((row) => [row.channel_id, row.channel_name]));
  const slots = new Map(state.data.resource_slots.map((row) => [row.slot_id, row.slot_name]));
  const existingByAction = new Map(existingTasks.map((task) => [task.strategy_action_id, task]));
  return actions.map((action, index) => {
    const existing = existingByAction.get(action.id) || {};
    const parts = [products.get(action.product_id) || action.product_id, channels.get(action.channel_id) || action.channel_id];
    if (action.slot_id) parts.push(slots.get(action.slot_id) || action.slot_id);
    return {
      id: existing.id || `EXEC-${String(index + 1).padStart(3, "0")}`,
      strategy_action_id: action.id,
      task_text: `${parts.join(" · ")}：${action.action_text}`,
      owner: existing.owner || action.owner || "",
      deadline: existing.deadline || action.deadline || "",
      status: existing.status || "待执行",
      rationale: action.rationale,
      updated_at: new Date().toISOString()
    };
  });
}

export function computeOutcomeComparison(outcome) {
  if (!outcome) return [];
  return [
    compare("门店整体销量", outcome.overall_before, outcome.overall_after),
    compare("动作涉及商品销量", outcome.selected_before, outcome.selected_after),
    compare("其他商品销量", outcome.other_before, outcome.other_after)
  ];
}

function compare(label, beforeValue, afterValue) {
  const before = numberOrNull(beforeValue);
  const after = numberOrNull(afterValue);
  const change = before === null || after === null || before === 0 ? null : ((after - before) / before) * 100;
  return { label, before, after, change_pct: change };
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function experimentSummary(experiment) {
  const usual = numberOrNull(experiment?.usual_prep_minutes);
  const mvp = numberOrNull(experiment?.mvp_prep_minutes);
  return {
    saved_minutes: usual !== null && mvp !== null ? usual - mvp : null,
    saved_pct: usual && mvp !== null ? ((usual - mvp) / usual) * 100 : null,
    reusable: experiment?.would_reuse === "yes"
  };
}
