import {
  DATASET_CONFIG,
  DATASET_KEYS,
  buildDecisionPacket,
  buildExecutionTasks,
  computeOutcomeComparison,
  emptyData,
  experimentSummary,
  normalizeDataset,
  parseCsv,
  templateCsv,
  toCsv,
  validateStrategyAction,
  validateWorkspace
} from "./core.mjs";
import { createDemoState } from "./demo.mjs";

const STORAGE_KEY = "assortment-decision-mvp-v1";
const STEPS = [
  [1, "创建经营任务", "定义目标与边界"],
  [2, "装载决策数据", "导入与校验"],
  [3, "决策资料包", "事实与冲突"],
  [4, "人工形成策略", "人做经营判断"],
  [5, "执行清单", "Owner 与 Deadline"],
  [6, "结果与实验反馈", "前后对比，不谈因果"]
];
const LIFECYCLE_LABEL = { new: "新品", regular: "常态", clearance: "清货", phase_out: "待下架" };
const STATUS_LABEL = { active: "在售", stopped: "停售", out_of_stock: "缺货" };
const LISTING_LABEL = { online: "已上线", offline: "未上线", pending: "待上线", paused: "已暂停", unknown: "未知" };
const ADJUST_LABEL = { adjustable: "可调整", locked: "锁定", unavailable: "不可用" };
const SEVERITY_LABEL = { block: "阻断", warn: "提醒", info: "信息" };
const numberFormat = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });

let storageNotice = "";
let state = loadState();
let toastTimer;
const app = document.querySelector("#app");
const bundleInput = document.querySelector("#bundle-import");

render();
bindEvents();

function blankState() {
  return {
    version: 1,
    step: 1,
    mode: "empty",
    task: null,
    data: emptyData(),
    loads: {},
    importIssues: [],
    packetGeneratedAt: null,
    strategyActions: [],
    executionTasks: [],
    outcome: null,
    experiment: {},
    prepStartedAt: null
  };
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return blankState();
    const parsed = JSON.parse(saved);
    if (parsed.version !== 1) throw new Error("数据版本不兼容");
    return {
      ...blankState(),
      ...parsed,
      data: { ...emptyData(), ...(parsed.data || {}) },
      loads: parsed.loads || {},
      importIssues: parsed.importIssues || [],
      strategyActions: parsed.strategyActions || [],
      executionTasks: parsed.executionTasks || [],
      experiment: parsed.experiment || {}
    };
  } catch (error) {
    storageNotice = `本地数据无法读取，已打开空白实验：${error.message}`;
    return blankState();
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    storageNotice = `本地保存失败：${error.message}`;
  }
}

function bindEvents() {
  app.addEventListener("click", handleClick);
  app.addEventListener("submit", handleSubmit);
  app.addEventListener("change", handleChange);
  bundleInput.addEventListener("change", importBundleFile);
}

function handleClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (action === "go-step") {
    state.step = Number(target.dataset.step);
    persist();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (action === "load-demo") loadDemo();
  if (action === "reset") resetWorkspace();
  if (action === "open-bundle") bundleInput.click();
  if (action === "export-workspace") exportWorkspace();
  if (action === "download-template") downloadTemplate(target.dataset.dataset);
  if (action === "generate-packet") generatePacket();
  if (action === "add-strategy") addStrategyAction();
  if (action === "remove-strategy") removeStrategyAction(target.dataset.id);
  if (action === "build-execution") buildExecution();
  if (action === "export-execution") exportExecution();
  if (action === "fill-outcome-demo") fillOutcomeDemo();
}

function handleSubmit(event) {
  if (event.target.id !== "task-form") return;
  event.preventDefault();
  const form = new FormData(event.target);
  const now = new Date().toISOString();
  state.task = {
    id: state.task?.id || `TASK-${Date.now()}`,
    name: String(form.get("name") || "").trim(),
    objective: String(form.get("objective") || "").trim(),
    target_metric: String(form.get("target_metric") || "").trim(),
    target_delta_pct: numberOrNull(form.get("target_delta_pct")),
    region: String(form.get("region") || "").trim(),
    store_scope: String(form.get("store_scope") || "").trim(),
    store_count: numberOrNull(form.get("store_count")),
    start_date: String(form.get("start_date") || ""),
    end_date: String(form.get("end_date") || ""),
    owner: String(form.get("owner") || "").trim(),
    protect_new: form.get("protect_new") === "on",
    clearance_task: form.get("clearance_task") === "on",
    notes: String(form.get("notes") || "").trim(),
    created_at: state.task?.created_at || now,
    updated_at: now
  };
  state.prepStartedAt ||= now;
  invalidatePacket(false);
  state.step = 2;
  persist();
  render();
  toast("经营任务已保存，请装载本次任务的决策数据");
}

async function handleChange(event) {
  const input = event.target;
  if (input.matches("input[type=file][data-dataset]")) {
    const file = input.files?.[0];
    if (file) await importDatasetFile(input.dataset.dataset, file);
    return;
  }
  if (input.matches("[data-strategy-id][data-field]")) {
    const action = state.strategyActions.find((item) => item.id === input.dataset.strategyId);
    if (action) {
      action[input.dataset.field] = input.value;
      state.executionTasks = [];
      persist();
      render();
    }
    return;
  }
  if (input.matches("[data-execution-id][data-field]")) {
    const task = state.executionTasks.find((item) => item.id === input.dataset.executionId);
    if (task) {
      task[input.dataset.field] = input.value;
      task.updated_at = new Date().toISOString();
      persist();
    }
    return;
  }
  if (input.matches("[data-outcome-field]")) {
    state.outcome ||= defaultOutcome();
    state.outcome[input.dataset.outcomeField] = input.value;
    state.outcome.updated_at = new Date().toISOString();
    persist();
    render();
    return;
  }
  if (input.matches("[data-experiment-field]")) {
    state.experiment[input.dataset.experimentField] = input.value;
    persist();
    render();
  }
}

function loadDemo() {
  if (hasUserData() && !window.confirm("加载 Demo 会替换当前浏览器中的实验数据。是否继续？")) return;
  state = createDemoState();
  storageNotice = "";
  persist();
  render();
  toast("已加载明确标记的演示数据；它不是已验证业务事实");
}

function resetWorkspace() {
  if (!window.confirm("确定清空当前浏览器中的任务、导入数据、策略和结果吗？请先导出需要保留的工作区。")) return;
  state = blankState();
  storageNotice = "";
  localStorage.removeItem(STORAGE_KEY);
  render();
  toast("已清空本地实验数据");
}

function hasUserData() {
  return Boolean(state.task || DATASET_KEYS.some((key) => state.loads[key]?.loaded) || state.strategyActions.length);
}

async function importDatasetFile(datasetKey, file) {
  try {
    const text = await file.text();
    let rawRows;
    if (file.name.toLowerCase().endsWith(".json")) {
      const parsed = JSON.parse(text);
      rawRows = Array.isArray(parsed) ? parsed : parsed[datasetKey] || parsed.data?.[datasetKey];
    } else {
      rawRows = parseCsv(text);
    }
    if (!Array.isArray(rawRows)) throw new Error("文件中没有找到该数据集数组");
    const normalized = normalizeDataset(datasetKey, rawRows);
    state.data[datasetKey] = normalized.rows;
    state.loads[datasetKey] = {
      loaded: true,
      source: file.name,
      imported_at: new Date().toISOString(),
      row_count: normalized.rows.length,
      mode: "real"
    };
    state.importIssues = state.importIssues.filter((item) => item.dataset !== datasetKey).concat(normalized.issues);
    state.mode = state.mode === "demo" || state.mode === "mixed" ? "mixed" : "real";
    invalidatePacket(true);
    persist();
    render();
    toast(`${DATASET_CONFIG[datasetKey].label}已导入 ${normalized.rows.length} 行，发现 ${normalized.issues.length} 个格式问题`);
  } catch (error) {
    toast(`导入失败：${error.message}`);
  }
}

async function importBundleFile() {
  const file = bundleInput.files?.[0];
  bundleInput.value = "";
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (parsed.version === 1 && parsed.data && parsed.loads) {
      const restored = { ...blankState(), ...parsed, data: { ...emptyData(), ...parsed.data } };
      const normalizedData = {};
      const importIssues = [];
      for (const key of DATASET_KEYS) {
        const result = normalizeDataset(key, restored.data[key] || []);
        normalizedData[key] = result.rows;
        importIssues.push(...result.issues);
      }
      state = { ...restored, data: normalizedData, importIssues, mode: restored.mode === "demo" ? "mixed" : restored.mode };
    } else {
      const sourceData = parsed.data || parsed;
      const next = blankState();
      const importIssues = [];
      for (const key of DATASET_KEYS) {
        if (!Array.isArray(sourceData[key])) continue;
        const result = normalizeDataset(key, sourceData[key]);
        next.data[key] = result.rows;
        next.loads[key] = { loaded: true, source: file.name, imported_at: new Date().toISOString(), row_count: result.rows.length, mode: "real" };
        importIssues.push(...result.issues);
      }
      next.task = parsed.task || null;
      next.importIssues = importIssues;
      next.mode = "real";
      next.step = next.task ? 2 : 1;
      next.prepStartedAt = new Date().toISOString();
      state = next;
    }
    persist();
    render();
    toast("JSON 工作区已导入；请先查看数据质量报告");
  } catch (error) {
    toast(`工作区导入失败：${error.message}`);
  }
}

function invalidatePacket(keepActions) {
  state.packetGeneratedAt = null;
  state.executionTasks = [];
  if (!keepActions) state.strategyActions = [];
}

function generatePacket() {
  const issues = allValidationIssues();
  const errors = issues.filter((item) => item.level === "error");
  if (errors.length) {
    toast(`还有 ${errors.length} 个阻塞问题，先修正或重新导入数据`);
    return;
  }
  state.packetGeneratedAt = new Date().toISOString();
  state.step = 3;
  persist();
  render();
  toast("决策资料包已按当前快照生成");
}

function addStrategyAction() {
  state.strategyActions.push({
    id: `ACTION-${Date.now()}`,
    product_id: "",
    channel_id: "",
    slot_id: "",
    action_text: "",
    rationale: "",
    owner: "",
    deadline: state.task?.end_date || ""
  });
  persist();
  render();
}

function removeStrategyAction(id) {
  state.strategyActions = state.strategyActions.filter((item) => item.id !== id);
  state.executionTasks = [];
  persist();
  render();
}

function buildExecution() {
  if (!state.strategyActions.length) {
    toast("请先填写至少一条人工策略动作");
    return;
  }
  const packet = buildDecisionPacket(state);
  const errors = state.strategyActions.flatMap((action) => validateStrategyAction(action, state, packet)).filter((item) => item.level === "error");
  if (errors.length) {
    toast(`策略动作还有 ${errors.length} 个阻塞问题`);
    return;
  }
  state.executionTasks = buildExecutionTasks(state.strategyActions, state, state.executionTasks);
  state.step = 5;
  persist();
  render();
  toast(`已把 ${state.strategyActions.length} 条人工策略转换为执行任务骨架`);
}

function fillOutcomeDemo() {
  if (state.mode !== "demo" && !window.confirm("这些是演示数字，不应与真实数据混用。仍要填充吗？")) return;
  state.outcome = {
    ...defaultOutcome(),
    before_label: "动作前 7 天（示例）",
    after_label: "动作后 7 天（示例）",
    overall_before: 12000,
    overall_after: 12960,
    selected_before: 3600,
    selected_after: 4212,
    other_before: 8400,
    other_after: 8748,
    notes: "仅用于演示前后对比计算，不代表真实经营结果。",
    updated_at: new Date().toISOString()
  };
  persist();
  render();
}

function defaultOutcome() {
  return {
    before_label: "",
    after_label: "",
    overall_before: "",
    overall_after: "",
    selected_before: "",
    selected_after: "",
    other_before: "",
    other_after: "",
    notes: ""
  };
}

function exportWorkspace() {
  downloadText(`货盘实验-${state.task?.id || "空白"}.json`, JSON.stringify({ ...state, exported_at: new Date().toISOString() }, null, 2), "application/json;charset=utf-8");
  toast("工作区 JSON 已导出");
}

function downloadTemplate(datasetKey) {
  downloadText(`${datasetKey}.csv`, `\uFEFF${templateCsv(datasetKey)}`, "text/csv;charset=utf-8");
}

function exportExecution() {
  if (!state.executionTasks.length) return;
  const rows = state.executionTasks.map((task) => ({
    execution_task_id: task.id,
    strategy_action_id: task.strategy_action_id,
    task: task.task_text,
    owner: task.owner,
    deadline: task.deadline,
    status: task.status,
    rationale: task.rationale
  }));
  downloadText(`执行清单-${state.task?.id || "task"}.csv`, `\uFEFF${toCsv(rows)}`, "text/csv;charset=utf-8");
}

function downloadText(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function allValidationIssues() {
  return dedupeIssues([...state.importIssues, ...validateWorkspace(state)]);
}

function dedupeIssues(issues) {
  const seen = new Set();
  return issues.filter((item) => {
    const key = `${item.level}|${item.code}|${item.dataset}|${item.row}|${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function render() {
  const validation = allValidationIssues();
  const packet = buildDecisionPacket(state);
  app.innerHTML = `
    <div class="shell">
      ${renderSidebar()}
      <div class="workspace">
        ${renderTopbar(validation)}
        <main class="content">${renderPage(validation, packet)}</main>
      </div>
    </div>
    <div class="toast" id="toast"></div>`;
}

function renderSidebar() {
  return `<aside class="sidebar">
    <div class="brand"><div class="brand-mark">盘</div><div><strong>经营决策助手</strong><span>资料先行 · 判断在人</span></div></div>
    <nav class="step-nav" aria-label="实验步骤">
      ${STEPS.map(([number, label, hint]) => `<button class="step-button ${state.step === number ? "active" : ""} ${stepDone(number) ? "done" : ""}" data-action="go-step" data-step="${number}">
        <span class="step-index">${stepDone(number) ? "✓" : number}</span><span>${label}</span><small>${hint}</small>
      </button>`).join("")}
    </nav>
    <div class="sidebar-note"><b>这不是自动经营系统</b>系统只整理可追溯事实、数据缺口与规则命中。商品、渠道、资源位和动作始终由负责人决定。</div>
  </aside>`;
}

function renderTopbar(validation) {
  const errors = validation.filter((item) => item.level === "error").length;
  const mode = modeMeta();
  return `<header class="topbar">
    <div class="mode-banner"><i class="mode-dot ${state.mode}"></i><div><strong>${mode.title}</strong><span>${mode.detail}${errors ? ` · 当前有 ${errors} 个阻塞问题` : ""}</span></div></div>
    <div class="top-actions">
      <button class="btn small soft" data-action="load-demo">加载 Demo</button>
      <button class="btn small" data-action="open-bundle">导入工作区 JSON</button>
      <button class="btn small" data-action="export-workspace">导出工作区</button>
      <button class="btn small danger" data-action="reset">清空本地数据</button>
    </div>
  </header>`;
}

function modeMeta() {
  if (state.mode === "demo") return { title: "演示模式", detail: "全部业务数据均为虚构样例，不代表真实经营事实" };
  if (state.mode === "real") return { title: "导入数据模式", detail: "请以来源、快照时间和质量报告判断是否可行动" };
  if (state.mode === "mixed") return { title: "混合数据警告", detail: "Demo 与导入数据已混合，不能用于真实经营决策" };
  return { title: "空白实验", detail: "尚未加载任何业务数据" };
}

function stepDone(number) {
  if (number === 1) return Boolean(state.task);
  if (number === 2) return Boolean(state.packetGeneratedAt);
  if (number === 3) return Boolean(state.packetGeneratedAt);
  if (number === 4) return state.strategyActions.length > 0;
  if (number === 5) return state.executionTasks.length > 0;
  if (number === 6) return Boolean(state.outcome?.updated_at && state.experiment?.mvp_prep_minutes);
  return false;
}

function renderPage(validation, packet) {
  const storage = storageNotice ? `<div class="notice error"><strong>本地存储提示</strong>${esc(storageNotice)}</div>` : "";
  const page = {
    1: renderTaskPage,
    2: renderDataPage,
    3: renderPacketPage,
    4: renderStrategyPage,
    5: renderExecutionPage,
    6: renderOutcomePage
  }[state.step] || renderTaskPage;
  return storage + page(validation, packet);
}

function renderPageHead(step, title, description, extra = "") {
  return `<div class="page-head"><div><div class="eyebrow">Step ${step} · MVP 实验</div><h1>${title}</h1><p>${description}</p></div>${extra}</div>`;
}

function renderTaskPage() {
  const task = state.task || {};
  return `${renderPageHead(1, "先把经营问题说清楚", "系统只在明确的区域、门店范围和时间窗内准备资料；目标文本保留业务原话，不自动推导策略。")}
    ${state.task ? renderTaskSummary() : `<div class="notice info"><strong>第一轮验证问题</strong>拿到目标后，自动准备事实与待确认项，能否减少找数、拼表和追问的时间？</div>`}
    <section class="card">
      <div class="card-head"><div><h2>${state.task ? "编辑当前任务" : "创建经营任务"}</h2><p>带 <span class="required">*</span> 的字段会参与资料筛选或实验记录。</p></div><div class="card-number">1</div></div>
      <form id="task-form" class="form-grid">
        ${fieldInput("任务名称", "name", task.name, true, "如：华东门店销量提升实验")}
        ${fieldInput("任务 Owner", "owner", task.owner, true, "负责最终经营判断的人")}
        ${fieldTextarea("目标原话", "objective", task.objective, true, "如：华东门店未来 7 天整体销量 +8%")}
        <label class="field"><span>目标指标 <i class="required">*</i></span><select name="target_metric" required>${options(["整体销量", "GMV", "毛利", "库存周转", "新品渗透", "其他"], task.target_metric, "请选择")}</select></label>
        ${fieldInput("目标变化（%）", "target_delta_pct", task.target_delta_pct, false, "8", "number", "0.1")}
        ${fieldInput("区域", "region", task.region, true, "华东")}
        ${fieldInput("门店范围说明", "store_scope", task.store_scope, true, "华东 120 家门店；真实实验建议附门店清单版本")}
        ${fieldInput("门店数", "store_count", task.store_count, false, "120", "number", "1")}
        ${fieldInput("开始日期", "start_date", task.start_date, true, "", "date")}
        ${fieldInput("结束日期", "end_date", task.end_date, true, "", "date")}
        <div class="check-row">
          <label class="check"><input type="checkbox" name="protect_new" ${task.protect_new ? "checked" : ""}> 保护新品资源</label>
          <label class="check"><input type="checkbox" name="clearance_task" ${task.clearance_task ? "checked" : ""}> 本周期存在清货任务</label>
        </div>
        ${fieldTextarea("已知约束与备注", "notes", task.notes, false, "只记录已知事实；不确定内容写成“待确认”")}
        <div class="form-actions"><button class="btn primary" type="submit">${state.task ? "保存并重新准备资料" : "创建任务并进入数据装载"}</button></div>
      </form>
    </section>`;
}

function renderTaskSummary() {
  const task = state.task;
  return `<section class="card task-summary"><div class="card-head"><div><h2>${esc(task.name)}</h2><p>${esc(task.objective)}</p></div><span class="pill ${state.packetGeneratedAt ? "green" : "amber"}">${state.packetGeneratedAt ? "资料包已生成" : "等待数据"}</span></div>
    <div class="task-meta"><span><b>范围</b> ${esc(task.region)} · ${esc(task.store_scope)}</span><span><b>周期</b> ${esc(task.start_date)} 至 ${esc(task.end_date)}</span><span><b>Owner</b> ${esc(task.owner)}</span></div></section>`;
}

function renderDataPage(validation) {
  const dataIssues = validation.filter((item) => item.dataset !== "task");
  const errors = dataIssues.filter((item) => item.level === "error").length;
  const warnings = dataIssues.filter((item) => item.level === "warning").length;
  const loaded = DATASET_KEYS.filter((key) => state.loads[key]?.loaded).length;
  return `${renderPageHead(2, "装载一次任务所需的最小事实", "支持每类一份 UTF-8 CSV/JSON，或导入整包 JSON。未上传是“未知”，不会被解释为没有项目或没有冲突。", `<div class="head-kpis"><div class="mini-kpi"><b>${loaded}/5</b><span>数据集已装载</span></div><div class="mini-kpi"><b>${errors}</b><span>阻塞问题</span></div><div class="mini-kpi"><b>${warnings}</b><span>待确认提醒</span></div></div>`)}
    ${!state.task ? `<div class="notice error"><strong>缺少经营任务</strong>先定义区域与时间窗，才能判断项目是否冲突、商品是否在范围内。</div>` : ""}
    <div class="data-toolbar"><p>Excel 暂不直接解析：请另存为“CSV UTF-8”。这是刻意的范围控制，用来验证资料准备价值，而不是建设数据中台。</p><div class="actions"><button class="btn soft" data-action="load-demo">加载五类 Demo 数据</button><button class="btn" data-action="open-bundle">导入整包 JSON</button></div></div>
    <section class="dataset-grid">${DATASET_KEYS.map(renderDatasetCard).join("")}</section>
    <section class="card" style="margin-top:16px">
      <div class="card-head"><div><h2>数据质量与关联报告</h2><p>错误会阻止生成资料包；提醒会保留在资料包首屏，由负责人判断是否可继续。</p></div><span class="pill ${errors ? "red" : warnings ? "amber" : "green"}">${errors ? `${errors} 个错误` : warnings ? `${warnings} 个提醒` : "可以生成"}</span></div>
      ${renderQualityList(dataIssues)}
      <div class="footer-actions"><span class="cell-sub">资料包不会静默丢弃或猜测未关联记录。</span><div class="right"><button class="btn primary" data-action="generate-packet" ${errors ? "disabled" : ""}>生成决策资料包 →</button></div></div>
    </section>`;
}

function renderDatasetCard(datasetKey) {
  const config = DATASET_CONFIG[datasetKey];
  const load = state.loads[datasetKey];
  const fields = config.fields.map((item) => item.name).join(", ");
  return `<article class="dataset-card ${config.requiredForPacket ? "required" : "optional"}">
    <div class="dataset-title"><div><h3>${esc(config.label)}</h3><p>${config.requiredForPacket ? "生成资料包必需" : "可缺失，但会显示风险"} · 建议 ${config.freshnessHours} 小时内</p></div><span class="pill ${load?.loaded ? (load.mode === "demo" ? "amber" : "green") : "gray"}">${load?.loaded ? `${load.row_count} 行` : "未装载"}</span></div>
    <div class="dataset-source">${load?.loaded ? `<b>${esc(load.source)}</b><br>导入：${formatDateTime(load.imported_at)}` : "来源未知。请上传文件，或明确加载 Demo。"}</div>
    <div class="dataset-actions"><label class="btn small primary file-label">选择 CSV / JSON<input type="file" data-dataset="${datasetKey}" accept=".csv,.json,text/csv,application/json"></label><button class="btn small" data-action="download-template" data-dataset="${datasetKey}">下载空模板</button></div>
    <div class="schema-line" title="${esc(fields)}">字段：${esc(fields)}</div>
  </article>`;
}

function renderQualityList(issues) {
  if (!issues.length) return `<div class="notice success"><strong>当前校验未发现问题</strong>仍需由业务负责人确认数据来源、口径和实际可行动性。</div>`;
  return `<div class="quality-list">${issues.slice(0, 30).map((item) => `<div class="quality-item"><span class="pill ${item.level === "error" ? "red" : item.level === "warning" ? "amber" : "blue"}">${item.level === "error" ? "错误" : item.level === "warning" ? "提醒" : "信息"}</span><p>${esc(item.message)}</p><small>${esc(DATASET_CONFIG[item.dataset]?.label || item.dataset)}${item.row ? ` · 第 ${item.row} 行` : ""}</small></div>`).join("")}${issues.length > 30 ? `<div class="cell-sub">另有 ${issues.length - 30} 条未展开；请修复数据源后重新导入。</div>` : ""}</div>`;
}

function renderPacketPage(validation, packet) {
  if (!state.packetGeneratedAt) return `${renderPageHead(3, "决策资料包", "资料包只能从当前已校验的数据快照生成。")}${emptyState("还没有可用的决策资料包", "先创建任务、装载数据并处理阻塞错误。", 2, "去装载数据")}`;
  const errors = validation.filter((item) => item.level === "error").length;
  const warnings = validation.filter((item) => item.level === "warning").length;
  const coverage = packet.channels.length ? Math.round((packet.matrix.flatMap((row) => row.cells).filter((cell) => cell.status !== "unknown").length / packet.matrix.flatMap((row) => row.cells).length) * 100) : 0;
  return `${renderPageHead(3, "当前任务的决策资料包", "这里展示事实、规则命中、数据缺口和可操作空间；排序只反映透明信号，不代表商品推荐。", `<div class="head-kpis"><div class="mini-kpi"><b>${formatDateTime(state.packetGeneratedAt, true)}</b><span>生成时间</span></div></div>`)}
    ${state.mode === "demo" ? `<div class="notice warn"><strong>这是一份演示资料包</strong>产品、销量、库存、项目与规则均为虚构。请勿据此作真实经营动作。</div>` : ""}
    <div class="metric-strip"><div class="metric-card"><b>${packet.attentionProducts.length}</b><span>商品事实</span></div><div class="metric-card"><b>${coverage}%</b><span>渠道状态覆盖</span></div><div class="metric-card"><b>${packet.conflicts.filter((item) => item.severity === "block").length}</b><span>阻断项</span></div><div class="metric-card"><b>${packet.adjustableSlots.length}</b><span>可调整资源位</span></div><div class="metric-card"><b>${warnings}</b><span>数据提醒</span></div></div>
    <section class="card"><div class="card-head"><div><h2>0. 先看资料是否可信</h2><p>在看商品前，先确认缺失、过期和关联问题。漂亮的矩阵不能替代可信数据。</p></div><span class="pill ${errors ? "red" : warnings ? "amber" : "green"}">${errors ? "不可行动" : warnings ? "带缺口生成" : "校验通过"}</span></div>${renderQualityList(validation)}</section>
    <section class="card"><div class="card-head"><div><h2>A. 当前值得查看的商品</h2><p>依据：生命周期、透明的销量变化、库存与规则命中；没有综合推荐分。</p></div></div>${renderAttentionTable(packet)}</section>
    <section class="card"><div class="card-head"><div><h2>B. 商品 × 渠道状态</h2><p>“未知”代表没有记录，不等于未上线；价格与销量只展示导入事实。</p></div><span class="pill ${packet.unknownMatrixCells ? "amber" : "green"}">${packet.unknownMatrixCells} 个未知单元</span></div>${renderMatrix(packet)}</section>
    <section class="card"><div class="card-head"><div><h2>C. 业务限制与冲突</h2><p>每条都显示触发证据与规则来源。系统提示，人负责权衡；阻断规则不能被静默忽略。</p></div></div>${renderFindings(packet.conflicts)}</section>
    <section class="grid-2"><div class="card"><div class="card-head"><div><h2>D1. 可调整资源位</h2><p>仅表示快照中标为可调，不等于审批已完成。</p></div></div>${renderSlotList(packet.adjustableSlots, true)}</div><div class="card"><div class="card-head"><div><h2>D2. 锁定 / 不可用资源位</h2><p>锁定原因缺失时会进入数据提醒。</p></div></div>${renderSlotList(packet.lockedSlots, false)}</div></section>
    <section class="card"><div class="card-head"><div><h2>D3. 明确的渠道空白</h2><p>这是“未上线/待上线”的事实清单，不是系统建议上线。未知状态不在此处。</p></div></div>${renderChannelGaps(packet)}</section>
    <div class="footer-actions"><button class="btn" data-action="go-step" data-step="2">← 返回数据</button><div class="right"><button class="btn primary" data-action="go-step" data-step="4">由负责人形成策略 →</button></div></div>`;
}

function renderAttentionTable(packet) {
  if (!packet.attentionProducts.length) return emptyInline("没有商品数据");
  const channelsCount = packet.channels.length;
  return `<div class="table-wrap"><table><thead><tr><th>商品</th><th>状态</th><th>近 7 日销量</th><th>相对前 7 日</th><th>库存 / 供应</th><th>渠道覆盖</th><th>关注信号</th></tr></thead><tbody>${packet.attentionProducts.map((product) => {
    const online = state.data.product_channel_states.filter((row) => row.product_id === product.product_id && row.listing_status === "online").length;
    return `<tr><td><div class="cell-main">${esc(product.product_name)}</div><div class="cell-sub">${esc(product.product_id)} · ${esc(product.category || "未分类")}</div></td><td><span class="pill ${product.level}">${product.level === "block" ? "有阻断" : product.level === "warn" ? "需确认" : "未见硬冲突"}</span><div class="cell-sub">${esc(LIFECYCLE_LABEL[product.lifecycle] || product.lifecycle)} · ${esc(STATUS_LABEL[product.status] || product.status)}</div></td><td>${formatNumber(product.sales_7d)}</td><td>${formatPercent(product.trend_pct)}</td><td>${formatNumber(product.stock_qty)}<div class="cell-sub">${esc(product.supply_status)}</div></td><td>${online}/${channelsCount}</td><td>${product.signal.map((signal) => `<span class="pill blue">${esc(signal)}</span>`).join(" ")}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function renderMatrix(packet) {
  if (!packet.channels.length) return emptyInline("没有渠道状态数据");
  return `<div class="table-wrap"><table><thead><tr><th>商品</th>${packet.channels.map((channel) => `<th>${esc(channel.channel_name)}</th>`).join("")}</tr></thead><tbody>${packet.matrix.map((row) => `<tr><td><div class="cell-main">${esc(row.product.product_name)}</div><div class="cell-sub">${esc(row.product.product_id)}</div></td>${row.cells.map((cell) => `<td class="matrix-cell"><span class="pill ${cell.status}">${esc(LISTING_LABEL[cell.status] || cell.status)}</span>${cell.state ? `<b>${cell.state.price == null ? "价格未知" : `¥${formatNumber(cell.state.price)}`}</b><small>近 7 日 ${formatNumber(cell.state.sales_7d)} · ${esc(cell.state.assortment_name || "货盘未知")}</small>` : `<small>没有导入记录</small>`}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function renderFindings(conflicts) {
  if (!conflicts.length) return `<div class="notice info"><strong>没有规则命中</strong>这只表示已装载且受支持的规则未命中，不代表现实中不存在口头规则或项目承诺。</div>`;
  return `<div class="finding-list">${conflicts.map((finding) => `<article class="finding ${finding.severity}"><span class="pill ${finding.severity}">${SEVERITY_LABEL[finding.severity]}</span><div><h4>${esc(finding.title)}</h4><p>${esc(finding.detail)} · 来源：${esc(finding.source)}</p><code>证据：${esc(finding.evidence)}</code></div></article>`).join("")}</div>`;
}

function renderSlotList(slots, adjustable) {
  if (!slots.length) return emptyInline(adjustable ? "没有明确可调整的资源位" : "没有锁定资源位记录");
  return `<div class="space-list">${slots.map((slot) => `<div class="space-row"><div><b>${esc(slot.slot_name)}</b><div class="cell-sub">${esc(slot.slot_id)}</div></div><span>${esc(slot.channel_name)} · 当前 ${esc(productName(slot.current_product_id) || "空")}${slot.lock_reason ? ` · ${esc(slot.lock_reason)}` : ""}</span><span class="pill ${slot.adjustability === "adjustable" ? "green" : "gray"}">${esc(ADJUST_LABEL[slot.adjustability] || slot.adjustability)}</span></div>`).join("")}</div>`;
}

function renderChannelGaps(packet) {
  if (!packet.channelGaps.length) return emptyInline("没有明确记录为未上线、待上线或暂停的商品渠道组合");
  return `<div class="table-wrap"><table><thead><tr><th>商品</th><th>渠道</th><th>当前状态</th><th>来源时间</th></tr></thead><tbody>${packet.channelGaps.map((row) => `<tr><td>${esc(productName(row.product_id) || row.product_id)}</td><td>${esc(row.channel_name)}</td><td><span class="pill ${row.listing_status}">${esc(LISTING_LABEL[row.listing_status] || row.listing_status)}</span></td><td>${formatDateTime(row.snapshot_at)}</td></tr>`).join("")}</tbody></table></div>`;
}

function renderStrategyPage(_validation, packet) {
  if (!state.packetGeneratedAt) return `${renderPageHead(4, "人工形成策略", "只有资料包生成后，负责人才能基于同一份事实记录动作。")}${emptyState("还没有资料包", "系统不会在缺少事实时预填策略。", 2, "去装载数据")}`;
  const actionIssues = state.strategyActions.map((action) => validateStrategyAction(action, state, packet));
  const errorCount = actionIssues.flat().filter((item) => item.level === "error").length;
  return `${renderPageHead(4, "现在轮到人做经营判断", "系统不会预填“推荐方案”。请选择商品、渠道、资源位和动作，并写下判断依据；冲突会跟随动作显示。", `<div class="head-kpis"><div class="mini-kpi"><b>${state.strategyActions.length}</b><span>人工动作</span></div><div class="mini-kpi"><b>${errorCount}</b><span>未完成 / 阻断</span></div></div>`)}
    <div class="notice info"><strong>人工判断边界</strong>销量、毛利、新品保护、清货和资源承诺之间的取舍由负责人承担；系统只校验动作是否引用了已知冲突。</div>
    <section class="card">
      <div class="card-head"><div><h2>策略动作</h2><p>一条动作将生成一条执行任务骨架；Owner 和 Deadline 可在下一步继续补齐。</p></div><button class="btn soft" data-action="add-strategy">＋ 新增动作</button></div>
      ${state.strategyActions.length ? state.strategyActions.map((action, index) => renderStrategyRow(action, index, actionIssues[index], packet)).join("") : emptyInline("暂无动作。请由货盘负责人新增，而不是让系统自动推荐。")}
      <div class="footer-actions"><button class="btn" data-action="go-step" data-step="3">← 返回资料包</button><div class="right"><button class="btn primary" data-action="build-execution" ${!state.strategyActions.length || errorCount ? "disabled" : ""}>生成执行清单 →</button></div></div>
    </section>`;
}

function renderStrategyRow(action, index, issues, packet) {
  return `<article class="strategy-row"><div class="strategy-row-head"><b>人工动作 ${index + 1}</b><button class="btn small danger" data-action="remove-strategy" data-id="${esc(action.id)}">删除</button></div>
    <div class="strategy-fields">
      <label class="field"><span>商品 <i class="required">*</i></span><select data-strategy-id="${esc(action.id)}" data-field="product_id">${entityOptions(state.data.product_performance, "product_id", "product_name", action.product_id, "请选择商品")}</select></label>
      <label class="field"><span>渠道 <i class="required">*</i></span><select data-strategy-id="${esc(action.id)}" data-field="channel_id">${entityOptions(packet.channels, "channel_id", "channel_name", action.channel_id, "请选择渠道")}</select></label>
      <label class="field"><span>资源位（可选）</span><select data-strategy-id="${esc(action.id)}" data-field="slot_id">${slotOptions(action.slot_id)}</select></label>
      <label class="field wide"><span>动作 <i class="required">*</i></span><input value="${esc(action.action_text)}" data-strategy-id="${esc(action.id)}" data-field="action_text" placeholder="如：调整展示顺序、补充上线、保持不动"></label>
      <label class="field"><span>判断依据 <i class="required">*</i></span><input value="${esc(action.rationale)}" data-strategy-id="${esc(action.id)}" data-field="rationale" placeholder="引用事实并说明取舍"></label>
      <label class="field"><span>建议 Owner</span><input value="${esc(action.owner)}" data-strategy-id="${esc(action.id)}" data-field="owner" placeholder="可在执行清单补齐"></label>
      <label class="field"><span>建议 Deadline</span><input type="date" value="${esc(action.deadline)}" data-strategy-id="${esc(action.id)}" data-field="deadline"></label>
    </div>
    ${issues.length ? `<div class="action-issues">${issues.map((item) => `<span class="action-issue ${item.level}">${esc(item.message)}</span>`).join("")}</div>` : `<div class="action-issues"><span class="pill green">未发现已知冲突</span></div>`}
  </article>`;
}

function renderExecutionPage() {
  if (!state.executionTasks.length) return `${renderPageHead(5, "执行清单", "只把人工确认的策略转换为可分派任务，不推断组织责任。")}${emptyState("还没有执行清单", "先由负责人填写策略动作，再生成任务骨架。", 4, "去填写策略")}`;
  const incomplete = state.executionTasks.filter((task) => !task.owner || !task.deadline).length;
  return `${renderPageHead(5, "把人工策略变成可执行承诺", "系统生成任务文字；Owner、Deadline 和状态由人确认。缺失责任人不会被自动猜测。", `<div class="head-kpis"><div class="mini-kpi"><b>${state.executionTasks.length}</b><span>执行任务</span></div><div class="mini-kpi"><b>${incomplete}</b><span>待补责任信息</span></div></div>`)}
    ${incomplete ? `<div class="notice warn"><strong>清单还不能交付执行</strong>有 ${incomplete} 条任务缺少 Owner 或 Deadline。</div>` : `<div class="notice success"><strong>执行责任信息已补齐</strong>可以导出 CSV 并进入现有协作流程。</div>`}
    <section class="card"><div class="card-head"><div><h2>${esc(state.task?.name || "当前任务")} · 执行拆解</h2><p>一条策略对应一条任务；本 MVP 不建设任务中心或审批流。</p></div><button class="btn soft" data-action="export-execution">导出执行清单 CSV</button></div>
      <div class="table-wrap"><table class="execution-table"><thead><tr><th>任务</th><th>Owner</th><th>Deadline</th><th>状态</th><th>人工依据</th></tr></thead><tbody>${state.executionTasks.map((task) => `<tr><td class="task-col"><div class="cell-main">${esc(task.task_text)}</div><div class="cell-sub">${esc(task.id)} · 来源 ${esc(task.strategy_action_id)}</div></td><td><input value="${esc(task.owner)}" data-execution-id="${esc(task.id)}" data-field="owner" placeholder="待指派"></td><td><input type="date" value="${esc(task.deadline)}" data-execution-id="${esc(task.id)}" data-field="deadline"></td><td><select data-execution-id="${esc(task.id)}" data-field="status">${options(["待执行", "进行中", "已完成", "已取消"], task.status)}</select></td><td>${esc(task.rationale)}</td></tr>`).join("")}</tbody></table></div>
    </section>
    <div class="footer-actions"><button class="btn" data-action="go-step" data-step="4">← 返回策略</button><div class="right"><button class="btn primary" data-action="go-step" data-step="6">进入结果与实验反馈 →</button></div></div>`;
}

function renderOutcomePage() {
  const outcome = state.outcome || defaultOutcome();
  const comparisons = computeOutcomeComparison(outcome);
  const experiment = experimentSummary(state.experiment);
  return `${renderPageHead(6, "回收最基础的结果，也回收实验本身", "销量只做描述性前后对比；MVP 是否有价值，主要看资料准备时间、额外查询和数据可靠性。")}
    <div class="notice warn"><strong>禁止因果解读</strong>同期活动、天气、季节、门店变化等都可能影响销量。这里的“变化”不等于“由策略造成”。</div>
    <section class="card"><div class="card-head"><div><h2>基础结果回收</h2><p>使用相同门店、商品和指标口径填写动作前后数据；没有数据时保持空白。</p></div>${state.mode === "demo" ? `<button class="btn soft" data-action="fill-outcome-demo">填充演示结果</button>` : ""}</div>
      <div class="form-grid" style="margin-bottom:15px">${simpleChangeField("前窗口说明", "before_label", outcome.before_label, "如：2026-10-11 至 10-17")}${simpleChangeField("后窗口说明", "after_label", outcome.after_label, "如：2026-10-19 至 10-25")}</div>
      <div class="outcome-grid">${comparisons.map((comparison, index) => renderOutcomeCard(comparison, outcome, index)).join("")}</div>
      <label class="field" style="margin-top:14px"><span>人工解释 / 口径说明</span><textarea data-outcome-field="notes" placeholder="记录同期活动、缺失数据和不确定性">${esc(outcome.notes)}</textarea></label>
    </section>
    <section class="card"><div class="card-head"><div><h2>MVP 价值验证记录</h2><p>建议至少跑 3 个真实任务；第一单可采用 shadow 模式，不直接影响经营。</p></div>${experiment.saved_minutes == null ? "" : `<div class="experiment-score"><span class="big">${formatNumber(experiment.saved_minutes)} 分钟</span><span class="cell-sub">本次记录的准备时间差<br>${formatPercent(experiment.saved_pct)}</span></div>`}</div>
      <div class="form-grid">
        ${experimentField("原流程资料准备分钟数", "usual_prep_minutes", state.experiment.usual_prep_minutes, "如：180", "number")}
        ${experimentField("使用 MVP 后准备分钟数", "mvp_prep_minutes", state.experiment.mvp_prep_minutes, "如：90", "number")}
        ${experimentField("生成资料包后仍需打开的表/系统数", "extra_sources_count", state.experiment.extra_sources_count, "如：2", "number")}
        ${experimentField("仍需追问的人数/次数", "clarification_count", state.experiment.clarification_count, "如：1", "number")}
        ${experimentField("未匹配记录数", "unmatched_count", state.experiment.unmatched_count, "必须全部可见", "number")}
        <label class="field"><span>下次是否愿意继续用</span><select data-experiment-field="would_reuse">${valueOptions([["", "请选择"], ["yes", "愿意"], ["maybe", "看情况"], ["no", "不愿意"]], state.experiment.would_reuse)}</select></label>
        ${experimentTextarea("最影响判断的缺失信息", "missing_information", state.experiment.missing_information, "哪些事实还得回群里或其他系统确认？")}
        ${experimentTextarea("本次实验备注", "notes", state.experiment.notes, "记录误报、漏报、返工和是否值得继续")}
      </div>
      <div class="notice info" style="margin-top:16px"><strong>建议判断门槛（待业务共同确认，不是已验证事实）</strong>资料准备人工时间下降至少 30%；策略涉及商品 ID 关联 100%；关键阻断漏报 0；未知不被误显示为“无”。</div>
    </section>
    <div class="footer-actions"><button class="btn" data-action="go-step" data-step="5">← 返回执行清单</button><div class="right"><button class="btn" data-action="export-workspace">导出完整实验记录</button></div></div>`;
}

function renderOutcomeCard(comparison, outcome, index) {
  const fields = [
    ["overall_before", "overall_after"],
    ["selected_before", "selected_after"],
    ["other_before", "other_after"]
  ][index];
  const hasChange = comparison.change_pct !== null;
  const trendClass = hasChange ? (comparison.change_pct >= 0 ? "positive" : "negative") : "";
  return `<article class="outcome-card"><h3>${esc(comparison.label)}</h3><div class="outcome-values"><label class="field"><span>前</span><input type="number" step="0.01" value="${esc(outcome[fields[0]])}" data-outcome-field="${fields[0]}" placeholder="—"></label><span class="arrow">→</span><label class="field"><span>后</span><input type="number" step="0.01" value="${esc(outcome[fields[1]])}" data-outcome-field="${fields[1]}" placeholder="—"></label></div><div class="comparison ${trendClass}"><b>${hasChange ? formatPercent(comparison.change_pct) : "待录入"}</b><span>${hasChange ? `${formatNumber(comparison.before)} → ${formatNumber(comparison.after)}` : "需要同口径前后值"}</span></div></article>`;
}

function fieldInput(label, name, value, required, placeholder, type = "text", step = "") {
  return `<label class="field"><span>${label}${required ? ' <i class="required">*</i>' : ""}</span><input type="${type}" name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${required ? "required" : ""} ${step ? `step="${step}"` : ""}></label>`;
}

function fieldTextarea(label, name, value, required, placeholder) {
  return `<label class="field full"><span>${label}${required ? ' <i class="required">*</i>' : ""}</span><textarea name="${name}" placeholder="${esc(placeholder)}" ${required ? "required" : ""}>${esc(value)}</textarea></label>`;
}

function simpleChangeField(label, fieldName, value, placeholder) {
  return `<label class="field"><span>${label}</span><input value="${esc(value)}" data-outcome-field="${fieldName}" placeholder="${esc(placeholder)}"></label>`;
}

function experimentField(label, fieldName, value, placeholder, type = "text") {
  return `<label class="field"><span>${label}</span><input type="${type}" min="0" value="${esc(value)}" data-experiment-field="${fieldName}" placeholder="${esc(placeholder)}"></label>`;
}

function experimentTextarea(label, fieldName, value, placeholder) {
  return `<label class="field full"><span>${label}</span><textarea data-experiment-field="${fieldName}" placeholder="${esc(placeholder)}">${esc(value)}</textarea></label>`;
}

function options(values, selected, placeholder = "") {
  return `${placeholder ? `<option value="">${esc(placeholder)}</option>` : ""}${values.map((value) => `<option value="${esc(value)}" ${String(selected ?? "") === value ? "selected" : ""}>${esc(value)}</option>`).join("")}`;
}

function valueOptions(values, selected) {
  return values.map(([value, label]) => `<option value="${esc(value)}" ${String(selected ?? "") === value ? "selected" : ""}>${esc(label)}</option>`).join("");
}

function entityOptions(rows, keyField, labelField, selected, placeholder) {
  return `<option value="">${esc(placeholder)}</option>${rows.map((row) => `<option value="${esc(row[keyField])}" ${row[keyField] === selected ? "selected" : ""}>${esc(row[labelField])} · ${esc(row[keyField])}</option>`).join("")}`;
}

function slotOptions(selected) {
  return `<option value="">不指定资源位</option>${state.data.resource_slots.map((slot) => `<option value="${esc(slot.slot_id)}" ${slot.slot_id === selected ? "selected" : ""}>${esc(slot.channel_name)} · ${esc(slot.slot_name)} · ${esc(ADJUST_LABEL[slot.adjustability] || slot.adjustability)}</option>`).join("")}`;
}

function emptyState(title, description, step, buttonLabel) {
  return `<div class="empty"><div><b>${esc(title)}</b><span>${esc(description)}</span><br><button class="btn primary" data-action="go-step" data-step="${step}">${esc(buttonLabel)}</button></div></div>`;
}

function emptyInline(message) {
  return `<div class="empty" style="min-height:110px"><div>${esc(message)}</div></div>`;
}

function productName(productId) {
  return state.data.product_performance.find((row) => row.product_id === productId)?.product_name || "";
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value) {
  return value === null || value === undefined || value === "" ? "—" : numberFormat.format(Number(value));
}

function formatPercent(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  const number = Number(value);
  return `${number >= 0 ? "+" : ""}${number.toFixed(1)}%`;
}

function formatDateTime(value, timeOnly = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return esc(value);
  return new Intl.DateTimeFormat("zh-CN", timeOnly ? { hour: "2-digit", minute: "2-digit" } : { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

function toast(message) {
  const element = document.querySelector("#toast");
  if (!element) return;
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("show"), 2600);
}
