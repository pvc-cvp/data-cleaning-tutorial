import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Check, X, ChevronRight, ChevronLeft, RotateCcw, BookOpen, AlertTriangle, Database, BookMarked, RefreshCw, ChevronDown, ChevronUp, Code, Trash2, Play, Terminal, Lightbulb, ArrowRight, Minus } from 'lucide-react';

const cw = (s) => { let w = 0; for (const c of String(s)) w += c.charCodeAt(0) > 0x7f ? 2 : 1; return w; };
const pad = (s, w, r) => { const p = Math.max(0, w - cw(String(s))); return r ? ' '.repeat(p) + s : s + ' '.repeat(p); };
function fmtDf(data) { if (!data || !data.length) return 'Empty DataFrame'; const cols = Object.keys(data[0]); const iw = String(data.length - 1).length; const ws = {}; cols.forEach(c => { ws[c] = Math.max(cw(c), ...data.map(r => cw(r[c] === '' || r[c] == null ? 'NaN' : String(r[c])))); }); const h = ' '.repeat(iw) + '  ' + cols.map(c => pad(c, ws[c])).join('  '); const rows = data.map((r, i) => { const idx = pad(String(i), iw, true); return idx + '  ' + cols.map(c => { const v = r[c]; const d = (v === '' || v == null) ? 'NaN' : String(v); return typeof v === 'number' ? pad(d, ws[c], true) : pad(d, ws[c]); }).join('  '); }); return h + '\n' + rows.join('\n'); }
function fmtInfo(data) { const cols = Object.keys(data[0] || {}); let o = `<class 'pandas.core.frame.DataFrame'>\nRangeIndex: ${data.length} entries, 0 to ${data.length - 1}\nData columns (total ${cols.length} columns):\n`; o += ` #   Column  Non-Null Count  Dtype\n---  ------  --------------  -----\n`; cols.forEach((c, i) => { const nn = data.filter(r => r[c] !== '' && r[c] != null).length; const dt = data.some(r => typeof r[c] === 'number') ? 'int64' : 'object'; o += ` ${i}   ${pad(c, 6)}  ${nn} non-null      ${dt}\n`; }); return o.trimEnd(); }
function fmtDesc(data) { const cols = Object.keys(data[0] || {}).filter(c => data.some(r => typeof r[c] === 'number')); if (!cols.length) return '(无数值列)'; const stats = {}; cols.forEach(c => { const vals = data.map(r => Number(r[c])).filter(v => !isNaN(v)).sort((a, b) => a - b); const n = vals.length; const sum = vals.reduce((a, b) => a + b, 0); const mean = sum / n; const std = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1)); const q = (p) => { const i = (n - 1) * p; const lo = Math.floor(i); return lo === n - 1 ? vals[lo] : vals[lo] + (vals[lo + 1] - vals[lo]) * (i - lo); }; stats[c] = { count: n, mean, std, min: vals[0], '25%': q(0.25), '50%': q(0.5), '75%': q(0.75), max: vals[n - 1] }; }); const labels = ['count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max']; const lw = 5; const cws = {}; cols.forEach(c => { cws[c] = Math.max(cw(c), ...labels.map(l => cw(stats[c][l].toFixed(l === 'count' ? 1 : 2)))); }); let o = pad('', lw) + '  ' + cols.map(c => pad(c, cws[c], true)).join('  ') + '\n'; labels.forEach(l => { o += pad(l, lw) + '  ' + cols.map(c => pad(stats[c][l].toFixed(l === 'count' ? 1 : 2), cws[c], true)).join('  ') + '\n'; }); return o.trimEnd(); }
function fmtNullSum(data) { const cols = Object.keys(data[0] || {}); const mw = Math.max(...cols.map(c => cw(c))); return cols.map(c => { const n = data.filter(r => r[c] === '' || r[c] == null).length; return pad(c, mw) + '    ' + n; }).join('\n') + '\ndtype: int64'; }
function execLine(raw, df) { let line = raw.trim(); if (!line || line.startsWith('#')) return { out: '', df }; const pm = line.match(/^print\s*\((.+)\)\s*$/); if (pm) line = pm[1].trim(); let m; m = line.match(/^df\s*\[\s*['"](.*?)['"]\s*\]\s*=\s*df\s*\[\s*['"](.*?)['"]\s*\]\.fillna\((.+)\)\s*$/); if (m) { const [, cl, cr, vs] = m; const v = vs.replace(/^['"]|['"]$/g, ''); return { out: '', df: df.map(r => ({ ...r, [cl]: (r[cr] === '' || r[cr] == null) ? (isNaN(Number(v)) ? v : Number(v)) : r[cr] })) }; } m = line.match(/^df\s*\[\s*['"](.*?)['"]\s*\]\s*=\s*df\s*\[\s*['"](.*?)['"]\s*\]\.str\.replace\(\s*['"](.+?)['"]\s*,\s*['"](.*?)['"]/); if (m) { const [, cl, cr, f, rp] = m; return { out: '', df: df.map(r => ({ ...r, [cl]: String(r[cr] ?? '').split(f).join(rp) })) }; } m = line.match(/^df\s*\[\s*['"](.*?)['"]\s*\]\s*=\s*df\s*\[\s*['"](.*?)['"]\s*\]\.str\.strip\(\)\s*$/); if (m) { const [, cl, cr] = m; return { out: '', df: df.map(r => ({ ...r, [cl]: String(r[cr] ?? '').trim() })) }; } m = line.match(/^df\s*\[\s*['"](.*?)['"]\s*\]\s*=\s*df\s*\[\s*['"](.*?)['"]\s*\]\.clip\((.+)\)\s*$/); if (m) { const [, cl, cr, args] = m; const loM = args.match(/lower\s*=\s*(-?\d+\.?\d*)/); const upM = args.match(/upper\s*=\s*(-?\d+\.?\d*)/); const lo = loM ? +loM[1] : -Infinity; const up = upM ? +upM[1] : Infinity; return { out: '', df: df.map(r => ({ ...r, [cl]: Math.min(Math.max(Number(r[cr]), lo), up) })) }; } m = line.match(/^df\s*\[\s*['"](.*?)['"]\s*\]\s*=\s*pd\.to_datetime\(df\s*\[\s*['"](.*?)['"]\s*\]\)\s*$/); if (m) { const [, cl, cr] = m; return { out: '', df: df.map(r => { const s = String(r[cr] ?? '').replace(/[年月]/g, '-').replace(/日/g, '').replace(/\./g, '-').replace(/\//g, '-'); const d = new Date(s); return { ...r, [cl]: isNaN(d) ? r[cr] : d.toISOString().split('T')[0] }; }) }; } m = line.match(/^df\s*\[\s*['"](.*?)['"]\s*\]\s*=\s*df\s*\[\s*['"](.*?)['"]\s*\]\.astype\(\s*(float|int)\s*\)\s*$/); if (m) { const [, cl, cr, t] = m; return { out: '', df: df.map(r => ({ ...r, [cl]: t === 'int' ? Math.round(Number(r[cr])) : Number(r[cr]) })) }; } m = line.match(/^df\s*=\s*df\.drop_duplicates\(.*?\)\s*$/); if (m) { const seen = new Set(); const nd = df.filter(r => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; }); return { out: `# 去重: ${df.length}行 → ${nd.length}行`, df: nd }; } m = line.match(/^df\s*=\s*df\.dropna\(.*?\)\s*$/); if (m) { const nd = df.filter(r => Object.values(r).every(v => v !== '' && v != null)); return { out: `# 删除空值行: ${df.length}行 → ${nd.length}行`, df: nd }; } if (/^df\.info\(\)\s*$/.test(line)) return { out: fmtInfo(df), df }; if (/^df\.describe\(\)\s*$/.test(line)) return { out: fmtDesc(df), df }; if (/^df\.shape\s*$/.test(line)) return { out: `(${df.length}, ${Object.keys(df[0] || {}).length})`, df }; m = line.match(/^df\.head\((\d+)?\)\s*$/); if (m) return { out: fmtDf(df.slice(0, m[1] ? +m[1] : 5)), df }; m = line.match(/^df\.tail\((\d+)?\)\s*$/); if (m) return { out: fmtDf(df.slice(-(m[1] ? +m[1] : 5))), df }; if (/^df\.columns\s*$/.test(line)) return { out: `Index([${Object.keys(df[0] || {}).map(c => `'${c}'`).join(', ')}], dtype='object')`, df }; if (/^df\.isnull\(\)\.sum\(\)\s*$/.test(line)) return { out: fmtNullSum(df), df }; if (/^df\.duplicated\(\)\.sum\(\)\s*$/.test(line)) { const s = new Set(); let c = 0; df.forEach(r => { const k = JSON.stringify(r); if (s.has(k)) c++; else s.add(k); }); return { out: String(c), df }; } if (/^len\(df\)\s*$/.test(line)) return { out: String(df.length), df }; m = line.match(/^df\s*\[\s*['"](.*?)['"]\s*\]\.value_counts\(\)\s*$/); if (m) { const col = m[1]; const ct = {}; df.forEach(r => { const v = (r[col] === '' || r[col] == null) ? 'NaN' : String(r[col]); ct[v] = (ct[v] || 0) + 1; }); const sorted = Object.entries(ct).sort((a, b) => b[1] - a[1]); const mw = Math.max(...sorted.map(([k]) => cw(k))); return { out: sorted.map(([k, v]) => pad(k, mw) + '    ' + v).join('\n') + `\nName: ${col}, dtype: int64`, df }; } m = line.match(/^df\s*\[\s*['"](.*?)['"]\s*\]\.(mean|median|min|max|sum|nunique)\(\)\s*$/); if (m) { const [, col, fn] = m; const vals = df.map(r => Number(r[col])).filter(v => !isNaN(v)).sort((a, b) => a - b); let res; if (fn === 'mean') res = vals.reduce((a, b) => a + b, 0) / vals.length; else if (fn === 'median') { const mid = Math.floor(vals.length / 2); res = vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2; } else if (fn === 'min') res = vals[0]; else if (fn === 'max') res = vals[vals.length - 1]; else if (fn === 'sum') res = vals.reduce((a, b) => a + b, 0); else if (fn === 'nunique') res = new Set(vals).size; return { out: String(parseFloat(Number(res).toFixed(2))), df }; } m = line.match(/^df\s*\[\s*['"](.*?)['"]\s*\]\.unique\(\)\s*$/); if (m) { const col = m[1]; const u = [...new Set(df.map(r => r[col] === '' ? 'NaN' : String(r[col])))]; return { out: `array([${u.map(v => `'${v}'`).join(', ')}], dtype=object)`, df }; } m = line.match(/^df\s*\[\s*['"](.*?)['"]\s*\]\s*$/); if (m) { const col = m[1]; const iw = String(df.length - 1).length; return { out: df.map((r, i) => pad(String(i), iw, true) + '    ' + ((r[col] === '' || r[col] == null) ? 'NaN' : r[col])).join('\n') + `\nName: ${col}, dtype: object`, df }; } if (/^df\.drop_duplicates\(.*?\)\s*$/.test(line)) { const s = new Set(); return { out: fmtDf(df.filter(r => { const k = JSON.stringify(r); if (s.has(k)) return false; s.add(k); return true; })), df }; } if (/^df\s*$/.test(line)) return { out: fmtDf(df), df }; return { out: `⚠️ 暂不支持: ${raw.trim()}\n💡 支持的命令: df, df.info(), df.describe(), df.shape, df.head(),\n   df.isnull().sum(), df.duplicated().sum(), df.drop_duplicates(),\n   df['列名'].fillna(), .str.replace(), .str.strip(), .clip(),\n   df['列名'].value_counts(), .mean(), .median(), .unique() 等`, df }; }
function runCode(code, df) { const lines = code.split('\n'); let cur = [...df.map(r => ({ ...r }))]; const outs = []; for (const l of lines) { if (!l.trim() || l.trim().startsWith('#')) continue; try { const { out, df: nd } = execLine(l, cur); cur = nd; if (out) outs.push(`>>> ${l.trim()}\n${out}`); else outs.push(`>>> ${l.trim()}`); } catch (e) { outs.push(`>>> ${l.trim()}\nError: ${e.message}`); } } return { output: outs.join('\n\n'), df: cur }; }

const kpInfo = {
  '数据问题识别': { icon: '01', tip: '先用 df.info() 和 df.describe() 做整体体检。' },
  '缺失值处理': { icon: '02', tip: '数值用 fillna(mean/median)，分类用 fillna("未知")。' },
  '重复数据识别': { icon: '03', tip: '用 duplicated() 检测，drop_duplicates() 去重。' },
  '格式标准化': { icon: '04', tip: '日期 to_datetime()，文本 str.strip()+str.replace()。' },
  '异常值判断': { icon: '05', tip: 'IQR法判定，clip() 截断比删除更温和。' },
  '业务逻辑理解': { icon: '06', tip: '脱离业务的清洗可能删掉有价值的数据。' },
  '清洗流程规范': { icon: '07', tip: '备份→去重→填充→格式化→异常值→验证。' },
};

const colLabels = { id: '序号', name: '姓名', phone: '手机号', city: '城市', amount: '金额', age: '年龄', salary: '薪资', order_id: '订单号', product: '产品', date: '日期', price: '单价', qty: '数量', total: '总价' };
const diffCfg = [null, { label: '入门', cls: 'text-neutral-400' }, { label: '基础', cls: 'text-neutral-500' }, { label: '进阶', cls: 'text-neutral-700' }, { label: '实战', cls: 'bg-black text-white px-2 py-0.5' }];

const lessons = [
  { id: 1, title: '认识脏数据', icon: '01', difficulty: 1, description: '数据清洗的第一步是学会识别数据中的问题。', concept: '脏数据是指不准确、不完整、不一致或重复的数据。拿到数据后先用 df.info() 做整体检查。', functions: { excel: [{ name: '条件格式', syntax: '开始 → 条件格式 → 突出显示规则', desc: '高亮空值/异常值' }], python: [{ name: 'df.info()', syntax: 'df.info()', desc: '查看每列数据类型和非空数量' }, { name: 'df.describe()', syntax: 'df.describe()', desc: '查看数值列统计摘要' }] }, data: [{ id: 1, name: '张三', phone: '13800138000', city: '北京', amount: 299 }, { id: 2, name: '李四', phone: '', city: '上海', amount: 150 }, { id: 3, name: '张三', phone: '13800138000', city: '北京', amount: 299 }, { id: 4, name: '王五', phone: '1390013', city: '广州', amount: -50 }, { id: 5, name: '赵六', phone: '13600136000', city: '深圳', amount: 888 }, { id: 6, name: '钱七', phone: '13700137000', city: '北京市', amount: 456 }], questions: [{ question: '观察数据表，你能发现几种数据问题？', options: ['1种', '2种', '3种', '4种及以上'], correct: 3, explanation: '至少4种：①手机号缺失；②第1、3行重复；③第4行手机号不足且金额为负；④"北京"与"北京市"不统一。', tags: ['数据问题识别'] }, { question: '哪个Python函数最适合第一眼了解数据全貌？', options: ['df.head()', 'df.info()', 'df.describe()', 'df.columns'], correct: 1, explanation: 'df.info() 展示总行数、非空数量、数据类型和内存使用，是最全面的起手式。', tags: ['数据问题识别'] }] },
  { id: 2, title: '处理缺失值', icon: '02', difficulty: 2, description: '学会用函数诊断和治疗缺失值。', concept: '少量缺失可填充（均值/中位数）；大量缺失考虑删列；关键字段缺失可删行。', functions: { excel: [{ name: 'IF+ISBLANK', syntax: '=IF(ISBLANK(B2), AVERAGE(B:B), B2)', desc: '为空则用均值填充' }], python: [{ name: 'df.isnull().sum()', syntax: 'df.isnull().sum()', desc: '统计每列缺失值数量' }, { name: 'df.fillna()', syntax: "df['年龄'].fillna(df['年龄'].mean())", desc: '用指定值填充缺失值' }, { name: 'df.dropna()', syntax: 'df.dropna(thresh=3)', desc: '删除非空值不足的行' }] }, data: [{ id: 1, name: '张三', age: 28, city: '北京', salary: 15000 }, { id: 2, name: '李四', age: '', city: '上海', salary: 12000 }, { id: 3, name: '王五', age: 35, city: '', salary: 18000 }, { id: 4, name: '赵六', age: 30, city: '广州', salary: '' }, { id: 5, name: '钱七', age: 26, city: '深圳', salary: 14000 }, { id: 6, name: '孙八', age: 32, city: '杭州', salary: 16000 }], questions: [{ question: '哪行代码能统计每列有多少缺失值？', options: ['df.count()', 'df.isnull().sum()', 'df.describe()', 'len(df)'], correct: 1, explanation: 'df.isnull() 标记空值为True，.sum() 对每列求和得到缺失数。', tags: ['缺失值处理'] }, { question: "执行 df['年龄'].fillna(df['年龄'].mean()) 后会发生什么？", code: "df['年龄'].fillna(df['年龄'].mean())", options: ['删除年龄为空的行', '用平均值填充空值', '将所有年龄替换为平均值', '返回平均值'], correct: 1, explanation: 'fillna() 只替换NaN，不影响已有数据。', tags: ['缺失值处理'] }, { question: 'df.dropna(thresh=3) 的含义是？', options: ['删除缺失超过3个的行', '保留至少3个非空值的行', '只保留前3行', '删除前3列缺失值'], correct: 1, explanation: 'thresh=门槛：一行至少要有3个非空值才保留。', tags: ['缺失值处理'] }] },
  { id: 3, title: '去除重复数据', icon: '03', difficulty: 2, description: '重复数据会让分析偏差。学会用函数高效去重。', concept: '去重关键是确定"业务主键"。完全重复直接去重；部分字段重复结合业务判断。', functions: { excel: [{ name: 'COUNTIF()', syntax: '=COUNTIF(B:B, B2)', desc: '统计出现次数' }], python: [{ name: 'duplicated()', syntax: "df.duplicated(subset=['订单号'])", desc: '标记重复行' }, { name: 'drop_duplicates()', syntax: "df.drop_duplicates(subset=['订单号'], keep='first')", desc: '按指定列去重' }] }, data: [{ id: 1, name: '张三', order_id: 'A001', product: '手机', amount: 2999 }, { id: 2, name: '李四', order_id: 'A002', product: '耳机', amount: 199 }, { id: 3, name: '张三', order_id: 'A001', product: '手机', amount: 2999 }, { id: 4, name: '张三', order_id: 'A003', product: '平板', amount: 3999 }, { id: 5, name: '王五', order_id: 'A004', product: '耳机', amount: 199 }, { id: 6, name: '李四', order_id: 'A002', product: '耳机', amount: 199 }], questions: [{ question: "=COUNTIF(B:B, B2)>1 的作用是？", options: ['计算B列总行数', '判断B2的值是否重复', '删除重复值', '去重后计数'], correct: 1, explanation: 'COUNTIF统计出现次数，>1说明至少出现2次，即存在重复。', tags: ['重复数据识别'] }, { question: "df.drop_duplicates(subset=['order_id'], keep='first') 后保留哪些行？", options: ['第1、2、4、5行', '只保留第1行', '全部6行', '第1、2、3、4、5行'], correct: 0, explanation: "只看订单号：A001保留第1行，A002保留第2行，A003第4行，A004第5行。", tags: ['重复数据识别'] }, { question: '哪个字段最适合作为去重主键？', options: ['客户姓名', '手机号码', '订单编号', '商品名称'], correct: 2, explanation: '订单编号是系统生成的唯一标识，最可靠。', tags: ['重复数据识别', '业务逻辑理解'] }] },
  { id: 4, title: '格式标准化', icon: '04', difficulty: 3, description: '格式不统一是分析的隐形杀手。', concept: 'pd.to_datetime() 可自动解析多种日期格式，str.replace() 配合正则可批量清理。', functions: { excel: [{ name: 'TRIM()', syntax: '=TRIM(A2)', desc: '去除首尾空格' }], python: [{ name: 'str.strip()', syntax: "df['城市'].str.strip()", desc: '去除首尾空白' }, { name: 'str.replace()', syntax: "df['金额'].str.replace(r'[¥元,]','',regex=True)", desc: '正则替换' }, { name: 'pd.to_datetime()', syntax: "pd.to_datetime(df['日期'])", desc: '统一日期格式' }] }, data: [{ id: 1, name: '张三', date: '2024-01-15', city: '北京市', amount: '¥299' }, { id: 2, name: '李四', date: '2024/2/3', city: '上海 ', amount: '150元' }, { id: 3, name: '王五', date: '20240315', city: '  广州市', amount: '888' }, { id: 4, name: '赵六', date: '2024.04.20', city: '深圳', amount: '¥456.00' }, { id: 5, name: '钱七', date: '2024年5月1日', city: ' 北京 ', amount: '1,200' }], questions: [{ question: "pd.to_datetime() 遇到5种日期格式会怎样？", options: ['报错', '自动识别并统一', '全变空值', '只能处理2种'], correct: 1, explanation: 'pd.to_datetime() 能自动识别大多数常见格式。', tags: ['格式标准化'] }, { question: '以下代码的作用？', code: "df['金额'].str.replace(r'[¥元,]','',regex=True).astype(float)", options: ['加上¥', '去符号后转数字', '转为字符串', '删除数字'], correct: 1, explanation: '正则移除¥元逗号后，astype(float)转为数字以便计算。', tags: ['格式标准化'] }, { question: '"城市"列的最完整清洗步骤是？', options: ['只去空格', '只去"市"', '先strip去空格再replace去"市"', '不处理'], correct: 2, explanation: '同时有空格和"市"两个问题，必须两步都做。', tags: ['格式标准化'] }] },
  { id: 5, title: '异常值检测', icon: '05', difficulty: 3, description: '异常值可能是洞察也可能是错误——关键在于判断。', concept: 'IQR法：上界=Q3+1.5×IQR，下界=Q1-1.5×IQR。clip()可截断超范围值。', functions: { excel: [{ name: 'PERCENTILE()', syntax: '=PERCENTILE(A:A,0.25)', desc: '计算分位数' }], python: [{ name: 'quantile()', syntax: "Q1=df['价格'].quantile(0.25)", desc: '计算百分位' }, { name: 'clip()', syntax: "df['价格'].clip(lower=10,upper=10000)", desc: '截断到边界值' }] }, data: [{ id: 1, product: '手机', price: 3999, qty: 1, total: 3999 }, { id: 2, product: '耳机', price: 199, qty: 2, total: 398 }, { id: 3, product: '手机', price: 3999, qty: -1, total: -3999 }, { id: 4, product: '耳机', price: 19900, qty: 1, total: 19900 }, { id: 5, product: '平板', price: 2999, qty: 100, total: 299900 }, { id: 6, product: '手机', price: 3999, qty: 1, total: 3999 }], questions: [{ question: 'Q1=100，Q3=300，异常值上界是？', options: ['400', '500', '600', '800'], correct: 2, explanation: 'IQR=200，上界=300+1.5×200=600。', tags: ['异常值判断'] }, { question: "clip(lower=10,upper=10000)后，19900变成？", options: ['19900', '10000', '199', '被删除'], correct: 1, explanation: 'clip()截断：大于upper的设为upper，不删除数据。', tags: ['异常值判断'] }, { question: '哪种情况不应该直接删除异常值？', options: ['手机号出现"abc"', '双十一金额高5倍', '年龄-5岁', '邮箱缺少@'], correct: 1, explanation: '双十一高额是正常业务现象，不是错误。', tags: ['异常值判断', '业务逻辑理解'] }] },
  { id: 6, title: '综合实战', icon: '06', difficulty: 4, description: '运用所有知识完成完整的数据清洗。', concept: '标准流程：备份→去重→缺失值→格式→异常值→验证。顺序不对会连锁出错。', functions: { excel: [{ name: '完整流程', syntax: '①删除重复项 ②COUNTBLANK ③TRIM ④IF+AND', desc: '四步走' }], python: [{ name: '链式清洗', syntax: "df = (df\n  .drop_duplicates(subset=['id'])\n  .assign(age=lambda x: x['age'].fillna(x['age'].median()))\n)", desc: '方法链一步清洗' }] }, data: [{ id: 1, name: '张三', phone: '13800138000', date: '2024-01-15', city: '北京', amount: 599 }, { id: 2, name: '李四', phone: '', date: '2024/02/20', city: '上海市', amount: 1200 }, { id: 3, name: '张三', phone: '13800138000', date: '2024-01-15', city: '北京', amount: 599 }, { id: 4, name: '王五', phone: '138', date: '2024-03-10', city: '广州', amount: -200 }, { id: 5, name: '赵六', phone: '13900139000', date: '2024.04.05', city: '深圳', amount: 99999 }, { id: 6, name: '钱七', phone: '13700137000', date: '2024-05-18', city: '北京市', amount: 350 }], questions: [{ question: '哪个清洗顺序最合理？', options: ['fillna→drop_duplicates→to_datetime→clip', 'drop_duplicates→fillna→to_datetime→clip', 'clip→fillna→drop_duplicates→to_datetime', 'to_datetime→clip→drop_duplicates→fillna'], correct: 1, explanation: '先去重→填充→格式→异常值。先填充再去重可能导致"伪去重失败"。', tags: ['清洗流程规范'] }, { question: '以下代码有什么Bug？', code: "df.drop_duplicates(inplace=True)\ndf['日期'] = pd.to_datetime(df['日期'])\ndf['金额'] = df['金额'].mean()", options: ['drop_duplicates用法有误', 'to_datetime用法有误', '第三行会把所有金额替换为均值', '没有问题'], correct: 2, explanation: "df['金额']=df['金额'].mean() 整列变成一个数！应用 fillna() 只填空值。", tags: ['缺失值处理', '清洗流程规范'] }, { question: "50万行数据：'备注'列95%空，'手机号'5%空，'城市'有不统一。最优策略？", options: ['删除所有含空行', '删备注列→手机号空行删→城市replace', '全用"无"填充', '不处理'], correct: 1, explanation: '备注95%空→删列。手机号缺5%→删行损失可控。城市→必须replace。', tags: ['缺失值处理', '格式标准化', '清洗流程规范'] }, { question: '最全面的验证方式是？', options: ['看df.head()', 'info()+describe()+抽样+业务规则', '只看df.shape', '直接交付'], correct: 1, explanation: 'info确认无缺失+类型正确，describe确认范围合理，抽样+业务规则验证。', tags: ['清洗流程规范'] }] },
];

const PG_INIT = [
  { '姓名': '张三', '手机号': '13800138000', '日期': '2024-01-15', '城市': '北京', '金额': 599 },
  { '姓名': '李四', '手机号': '', '日期': '2024/02/20', '城市': '上海市', '金额': 1200 },
  { '姓名': '张三', '手机号': '13800138000', '日期': '2024-01-15', '城市': '北京', '金额': 599 },
  { '姓名': '王五', '手机号': '138', '日期': '2024-03-10', '城市': '广州', '金额': -200 },
  { '姓名': '赵六', '手机号': '13900139000', '日期': '2024.04.05', '城市': '深圳', '金额': 99999 },
  { '姓名': '钱七', '手机号': '13700137000', '日期': '2024-05-18', '城市': '北京市', '金额': 350 },
];

const pgTasks = [
  { id: 'explore', icon: '01', title: '查看数据信息', hint: "df.info()", pattern: /df\.(info|shape|describe)\s*\(/ },
  { id: 'null', icon: '02', title: '统计缺失值', hint: "df.isnull().sum()", pattern: /isnull\(\)\.sum\(\)/ },
  { id: 'dedup', icon: '03', title: '去除重复行', hint: "df = df.drop_duplicates()", stateCheck: d => d.length <= 5 },
  { id: 'fillna', icon: '04', title: '处理缺失值', hint: "df['手机号'] = df['手机号'].fillna('未知')", stateCheck: d => d.every(r => r['手机号'] && r['手机号'] !== '') },
  { id: 'format', icon: '05', title: '统一城市格式', hint: "df['城市'] = df['城市'].str.replace('市', '')", stateCheck: d => d.every(r => !String(r['城市']).includes('市')) },
  { id: 'outlier', icon: '06', title: '处理异常金额', hint: "df['金额'] = df['金额'].clip(lower=0, upper=50000)", stateCheck: d => d.every(r => r['金额'] >= 0 && r['金额'] <= 50000) },
  { id: 'verify', icon: '07', title: '查看清洗结果', hint: "df", pattern: /^(df|print\s*\(\s*df\s*\))$/, stateCheck: d => d.length <= 5 && d.every(r => r['手机号'] !== '' && r['金额'] >= 0) },
];

const cellStyle = (val, col) => {
  if (val === '' || val == null) return 'bg-neutral-100';
  const s = String(val);
  if (col === 'phone' && /^\d+$/.test(s) && s.length < 11 && s.length > 0) return 'bg-neutral-100';
  if (['amount', 'total', 'salary', '金额'].includes(col)) { const n = parseFloat(s.replace(/[^0-9.\-]/g, '')); if (!isNaN(n) && n < 0) return 'bg-neutral-100'; }
  return '';
};

const serif = { fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" };

export default function DataCleaningQuiz() {
  const [curLesson, setCurLesson] = useState(0);
  const [curQ, setCurQ] = useState(0);
  const [selAns, setSelAns] = useState(null);
  const [showExp, setShowExp] = useState(false);
  const [score, setScore] = useState(0);
  const [totalAns, setTotalAns] = useState(0);
  const [completed, setCompleted] = useState([]);
  const [view, setView] = useState('menu');
  const [wrongAns, setWrongAns] = useState({});
  const [expCards, setExpCards] = useState({});
  const [funcTab, setFuncTab] = useState('python');
  const [retryKeys, setRetryKeys] = useState([]);
  const [retryIdx, setRetryIdx] = useState(0);
  const [retryOk, setRetryOk] = useState(0);
  const [retrySel, setRetrySel] = useState(null);
  const [retryExp, setRetryExp] = useState(false);
  const [pgDf, setPgDf] = useState(PG_INIT.map(r => ({ ...r })));
  const [pgCode, setPgCode] = useState("# 在此输入Python代码，点击运行\n# 示例：df.info()\n\ndf.info()");
  const [pgOutput, setPgOutput] = useState('');
  const [pgDone, setPgDone] = useState(new Set());
  const [pgHistory, setPgHistory] = useState([]);
  const [pgShowData, setPgShowData] = useState(true);
  const [pgShowHint, setPgShowHint] = useState(null);
  const outRef = useRef(null);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&display=swap';
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch(e) {} };
  }, []);

  const wrongCount = Object.keys(wrongAns).length;
  const tagStats = useMemo(() => { const s = {}; Object.values(wrongAns).forEach(({ li, qi }) => { lessons[li].questions[qi].tags.forEach(t => { s[t] = (s[t] || 0) + 1; }); }); return Object.entries(s).sort((a, b) => b[1] - a[1]); }, [wrongAns]);
  const lesson = lessons[curLesson];
  const question = lesson?.questions[curQ];

  const handleAnswer = (i) => { if (showExp) return; setSelAns(i); setShowExp(true); setTotalAns(t => t + 1); const key = `${curLesson}-${curQ}`; if (i === question.correct) { setScore(s => s + 1); if (wrongAns[key]) { const n = { ...wrongAns }; delete n[key]; setWrongAns(n); } } else setWrongAns(p => ({ ...p, [key]: { li: curLesson, qi: curQ, sel: i, att: (p[key]?.att || 0) + 1 } })); };
  const nextQ = () => { if (curQ < lesson.questions.length - 1) setCurQ(curQ + 1); else { if (!completed.includes(curLesson)) setCompleted([...completed, curLesson]); if (curLesson < lessons.length - 1) { setCurLesson(curLesson + 1); setCurQ(0); } else setView('summary'); } setSelAns(null); setShowExp(false); };
  const startLesson = i => { setCurLesson(i); setCurQ(0); setSelAns(null); setShowExp(false); setView('lesson'); };
  const resetAll = () => { setCurLesson(0); setCurQ(0); setSelAns(null); setShowExp(false); setScore(0); setTotalAns(0); setCompleted([]); setWrongAns({}); setExpCards({}); setView('menu'); };
  const startRetry = () => { const k = Object.keys(wrongAns); if (!k.length) return; setRetryKeys([...k]); setRetryIdx(0); setRetryOk(0); setRetrySel(null); setRetryExp(false); setView('retry'); };
  const handleRetryAns = i => { if (retryExp) return; setRetrySel(i); setRetryExp(true); const key = retryKeys[retryIdx]; const wa = wrongAns[key]; const q = lessons[wa.li].questions[wa.qi]; if (i === q.correct) { setRetryOk(c => c + 1); const n = { ...wrongAns }; delete n[key]; setWrongAns(n); } else setWrongAns(p => ({ ...p, [key]: { ...p[key], sel: i, att: (p[key]?.att || 0) + 1 } })); };
  const nextRetry = () => { setRetrySel(null); setRetryExp(false); setRetryIdx(retryIdx + 1); };

  const pgRun = () => { const { output, df: newDf } = runCode(pgCode, pgDf); setPgDf(newDf); setPgOutput(output); setPgHistory(h => [...h, pgCode]); const newDone = new Set(pgDone); const allCmds = [...pgHistory, pgCode].join('\n'); pgTasks.forEach(t => { let pass = true; if (t.pattern && !t.pattern.test(allCmds) && !t.pattern.test(pgCode)) pass = false; if (t.stateCheck && !t.stateCheck(newDf)) pass = false; if (!t.pattern && !t.stateCheck) pass = false; if (pass) newDone.add(t.id); }); setPgDone(newDone); setTimeout(() => { if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight; }, 50); };
  const pgReset = () => { setPgDf(PG_INIT.map(r => ({ ...r }))); setPgCode("# 在此输入Python代码\ndf.info()"); setPgOutput(''); setPgDone(new Set()); setPgHistory([]); };
  const handleKeyDown = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); pgRun(); } };

  const DataTable = ({ data, cols: customCols }) => {
    const d = data || [];
    if (!d.length) return null;
    const cols = customCols || Object.keys(d[0]);
    return (
      <div className="border border-black mb-6 overflow-x-auto">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-200">
          <Database size={14} strokeWidth={1.5} className="text-neutral-400" />
          <span className="text-xs tracking-widest uppercase text-neutral-400 font-mono">Data — {d.length} rows</span>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="bg-black text-white">{cols.map(c => <th key={c} className="text-left py-2 px-3 font-normal text-xs tracking-wider whitespace-nowrap">{colLabels[c] || c}</th>)}</tr></thead>
          <tbody>{d.map((row, ri) => <tr key={ri} className="border-b border-neutral-100 last:border-b-0">{cols.map(c => { const v = row[c]; const hl = cellStyle(v, c); return <td key={c} className={`py-2 px-3 whitespace-nowrap text-xs ${hl} ${v === '' ? 'italic text-neutral-300' : 'text-black'}`}>{v === '' ? '(空)' : String(v)}</td>; })}</tr>)}</tbody>
        </table>
      </div>
    );
  };

  const FuncRef = ({ functions }) => (
    <div className="bg-black p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Code size={14} strokeWidth={1.5} className="text-neutral-400" />
          <span className="text-xs tracking-widest uppercase text-neutral-400 font-mono">Reference</span>
        </div>
        <div className="flex">
          <button onClick={() => setFuncTab('excel')} className={`px-3 py-1 text-xs font-mono tracking-wider border transition-colors duration-100 ${funcTab === 'excel' ? 'bg-white text-black border-white' : 'bg-transparent text-neutral-500 border-neutral-700 hover:text-white hover:border-white'}`}>EXCEL</button>
          <button onClick={() => setFuncTab('python')} className={`px-3 py-1 text-xs font-mono tracking-wider border border-l-0 transition-colors duration-100 ${funcTab === 'python' ? 'bg-white text-black border-white' : 'bg-transparent text-neutral-500 border-neutral-700 hover:text-white hover:border-white'}`}>PYTHON</button>
        </div>
      </div>
      <div className="space-y-3">{(functions[funcTab] || []).map((f, i) => <div key={i} className="border border-neutral-700 p-3"><div className="flex items-start gap-3 mb-1.5"><span className="text-white font-mono text-xs font-bold">{f.name}</span><span className="text-neutral-500 text-xs">{f.desc}</span></div><pre className="text-neutral-300 text-xs font-mono whitespace-pre-wrap">{f.syntax}</pre></div>)}</div>
    </div>
  );

  const OptBtn = ({ opt, i, q, sel, show, onSel }) => {
    let cls = 'border border-black bg-white text-black hover:bg-black hover:text-white cursor-pointer';
    if (show) {
      if (i === q.correct) cls = 'bg-black text-white border-2 border-black';
      else if (i === sel) cls = 'bg-neutral-100 border-2 border-black text-black';
      else cls = 'border border-neutral-200 text-neutral-300 bg-white';
    }
    return (
      <button onClick={() => onSel(i)} disabled={show} className={`w-full text-left p-3 transition-colors duration-100 text-sm ${cls}`}>
        <div className="flex items-center gap-3">
          <span className={`w-6 h-6 flex items-center justify-center text-xs font-bold font-mono flex-shrink-0 ${show && i === q.correct ? 'bg-white text-black' : show && i === sel && i !== q.correct ? 'bg-black text-white' : show && i !== q.correct && i !== sel ? 'border border-neutral-200 text-neutral-300' : 'border border-current'}`}>{String.fromCharCode(65 + i)}</span>
          <span className="flex-1 font-mono text-xs sm:text-sm">{opt}</span>
          {show && i === q.correct && <Check size={16} strokeWidth={2} className="flex-shrink-0" />}
          {show && i === sel && i !== q.correct && <X size={16} strokeWidth={2} className="flex-shrink-0" />}
        </div>
      </button>
    );
  };

  const ExpBox = ({ ok, text }) => (
    <div className={`mt-5 p-4 border-2 ${ok ? 'bg-black text-white border-black' : 'bg-white text-black border-black'}`}>
      <div className="flex items-start gap-3">
        {ok ? <Check size={16} strokeWidth={2} className="mt-0.5 flex-shrink-0" /> : <X size={16} strokeWidth={2} className="mt-0.5 flex-shrink-0" />}
        <div>
          <div className="text-sm font-bold mb-1 font-mono">{ok ? 'CORRECT' : 'INCORRECT'}</div>
          <p className={`text-xs leading-relaxed ${ok ? 'text-neutral-300' : 'text-neutral-600'}`}>{text}</p>
        </div>
      </div>
    </div>
  );

  const CodeBlock = ({ code }) => <pre className="bg-black text-neutral-300 text-xs p-4 font-mono mb-4 overflow-x-auto whitespace-pre-wrap border border-neutral-800">{code}</pre>;
  const Rule = () => <div className="h-1 bg-black w-full my-6" />;

  // ========== MENU ==========
  if (view === 'menu') {
    return (
      <div className="min-h-screen bg-white p-6" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
        <div className="max-w-2xl mx-auto pt-12">
          <div className="text-center mb-2">
            <div className="h-1 bg-black w-16 mx-auto mb-8" />
            <h1 className="text-5xl md:text-6xl font-bold text-black tracking-tight leading-none mb-3" style={serif}>数据清洗</h1>
            <p className="text-xs tracking-widest uppercase text-neutral-400 font-mono mb-1">Data Cleaning Tutorial</p>
            <p className="text-sm text-neutral-500">6关理论 · Python实操 · Excel & Python 双线教学</p>
            <div className="h-1 bg-black w-16 mx-auto mt-8" />
          </div>

          <div className="flex gap-0 mb-8 mt-8">
            {score > 0 && (
              <div className="flex-1 border border-black p-4 flex items-center justify-between">
                <span className="text-xs tracking-widest uppercase text-neutral-500 font-mono">Score</span>
                <span className="text-2xl font-bold text-black" style={serif}>{score}/{totalAns}</span>
              </div>
            )}
            <button onClick={() => setView('wrongBook')} className={`flex-1 border border-black p-4 flex items-center justify-between transition-colors duration-100 hover:bg-black hover:text-white group ${score > 0 ? 'border-l-0' : ''}`}>
              <span className="text-xs tracking-widest uppercase text-neutral-500 font-mono flex items-center gap-2 group-hover:text-neutral-300"><BookMarked size={14} strokeWidth={1.5} />Errors</span>
              <span className={`text-2xl font-bold group-hover:text-white ${wrongCount > 0 ? 'text-black' : 'text-neutral-300'}`} style={serif}>{wrongCount}</span>
            </button>
          </div>

          <div className="space-y-0">
            {lessons.map((l, i) => {
              const done = completed.includes(i);
              const dc = diffCfg[l.difficulty];
              return (
                <button key={l.id} onClick={() => startLesson(i)} className={`w-full text-left p-5 border border-black transition-colors duration-100 group hover:bg-black hover:text-white ${i > 0 ? 'border-t-0' : ''}`}>
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-bold text-neutral-200 group-hover:text-neutral-600 font-mono w-12 flex-shrink-0" style={serif}>{String(i + 1).padStart(2, '0')}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-mono ${dc.cls} group-hover:text-neutral-300`}>{dc.label}</span>
                        {done && <Check size={14} strokeWidth={2} className="text-black group-hover:text-white" />}
                      </div>
                      <div className="font-bold text-black group-hover:text-white text-lg" style={serif}>{l.title}</div>
                      <div className="text-xs text-neutral-400 group-hover:text-neutral-400 font-mono">{l.questions.length} questions</div>
                    </div>
                    <ArrowRight size={18} strokeWidth={1.5} className="text-neutral-300 group-hover:text-white" />
                  </div>
                </button>
              );
            })}

            <button onClick={() => setView('playground')} className="w-full text-left p-5 bg-black text-white border border-black transition-colors duration-100 hover:bg-white hover:text-black group">
              <div className="flex items-center gap-4">
                <span className="text-3xl font-bold text-neutral-600 group-hover:text-neutral-300 font-mono w-12 flex-shrink-0" style={serif}>PY</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono text-neutral-400 group-hover:text-neutral-500">HANDS-ON</span>
                  </div>
                  <div className="font-bold text-lg" style={serif}>Python 实操练习</div>
                  <div className="text-xs text-neutral-500 group-hover:text-neutral-400 font-mono">在模拟环境中编写真实的 pandas 代码</div>
                </div>
                <Terminal size={18} strokeWidth={1.5} className="text-neutral-500 group-hover:text-neutral-400" />
              </div>
            </button>
          </div>

          {completed.length === lessons.length && (
            <button onClick={resetAll} className="w-full mt-6 py-4 border-2 border-black text-black font-mono text-xs tracking-widest uppercase hover:bg-black hover:text-white transition-colors duration-100 flex items-center justify-center gap-2">
              <RotateCcw size={14} strokeWidth={1.5} />Reset All
            </button>
          )}
        </div>
      </div>
    );
  }

  // ========== PLAYGROUND ==========
  if (view === 'playground') {
    const allDone = pgTasks.every(t => pgDone.has(t.id));
    return (
      <div className="min-h-screen bg-black p-4 md:p-6" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6 pt-2">
            <button onClick={() => setView('menu')} className="flex items-center gap-1 text-xs text-neutral-500 hover:text-white font-mono tracking-wider transition-colors duration-100"><ChevronLeft size={14} strokeWidth={1.5} />BACK</button>
            <div className="flex items-center gap-3">
              <span className="text-white text-sm font-mono">PYTHON LAB</span>
              <button onClick={pgReset} className="text-xs text-neutral-600 hover:text-white flex items-center gap-1 font-mono transition-colors duration-100"><RotateCcw size={12} strokeWidth={1.5} />RESET</button>
            </div>
          </div>

          <div className="border border-neutral-700 mb-4">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800">
              <span className="text-xs tracking-widest uppercase text-neutral-400 font-mono">Tasks — {pgDone.size}/{pgTasks.length}</span>
              {allDone && <span className="text-xs font-mono text-white border border-white px-2 py-0.5">COMPLETE</span>}
            </div>
            <div className="flex gap-0 mx-4 my-3">{pgTasks.map(t => <div key={t.id} className={`h-0.5 flex-1 ${pgDone.has(t.id) ? 'bg-white' : 'bg-neutral-800'}`} />)}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
              {pgTasks.map((t, i) => {
                const done = pgDone.has(t.id);
                const showHint = pgShowHint === t.id;
                return (
                  <div key={t.id} className={`p-3 text-xs border-t border-neutral-800 ${i % 2 === 0 ? 'sm:border-r' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono ${done ? 'text-white' : 'text-neutral-600'}`}>{done ? '✓' : t.icon}</span>
                      <span className={`flex-1 font-mono ${done ? 'text-neutral-500 line-through' : 'text-neutral-300'}`}>{t.title}</span>
                      {!done && <button onClick={() => setPgShowHint(showHint ? null : t.id)} className="text-neutral-600 hover:text-white transition-colors duration-100"><Lightbulb size={12} strokeWidth={1.5} /></button>}
                    </div>
                    {showHint && !done && (
                      <div className="mt-2 bg-neutral-900 border border-neutral-700 p-2 flex items-center justify-between">
                        <span className="text-neutral-300 font-mono text-xs">{t.hint}</span>
                        <button onClick={() => { setPgCode(t.hint); setPgShowHint(null); }} className="text-white hover:underline text-xs font-mono ml-2">USE</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border border-neutral-700 mb-4 overflow-hidden">
            <button onClick={() => setPgShowData(!pgShowData)} className="w-full flex items-center justify-between p-3 text-xs text-neutral-400 hover:text-white transition-colors duration-100 font-mono tracking-wider">
              <span className="flex items-center gap-2"><Database size={14} strokeWidth={1.5} />DATA — {pgDf.length}R × {Object.keys(pgDf[0] || {}).length}C</span>
              {pgShowData ? <ChevronUp size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
            </button>
            {pgShowData && (
              <div className="px-3 pb-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr>{Object.keys(pgDf[0] || {}).map(c => <th key={c} className="text-left py-1.5 px-2 bg-neutral-900 font-normal text-neutral-400 border-b border-neutral-700 whitespace-nowrap font-mono">{c}</th>)}</tr></thead>
                  <tbody>{pgDf.map((row, ri) => <tr key={ri} className="border-b border-neutral-800">{Object.entries(row).map(([c, v]) => <td key={c} className={`py-1.5 px-2 whitespace-nowrap font-mono ${v === '' || v == null ? 'text-neutral-600 italic' : typeof v === 'number' ? 'text-white' : 'text-neutral-300'}`}>{v === '' || v == null ? 'NaN' : String(v)}</td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
          </div>

          <div className="border border-neutral-700 mb-4 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800">
              <span className="text-xs text-neutral-500 flex items-center gap-2 font-mono tracking-wider"><Code size={12} strokeWidth={1.5} />EDITOR</span>
              <span className="text-xs text-neutral-700 font-mono">Ctrl+Enter</span>
            </div>
            <textarea value={pgCode} onChange={e => setPgCode(e.target.value)} onKeyDown={handleKeyDown} className="w-full bg-neutral-950 text-white font-mono text-sm p-4 border-none outline-none resize-none" rows={6} spellCheck={false} placeholder="# 输入 Python 代码..." />
            <div className="px-4 py-3 border-t border-neutral-800 flex items-center gap-3">
              <button onClick={pgRun} className="flex items-center gap-2 px-6 py-2 bg-white text-black text-xs font-mono tracking-widest uppercase hover:bg-neutral-200 transition-colors duration-100"><Play size={12} strokeWidth={2} />RUN</button>
              <span className="text-xs text-neutral-700 font-mono hidden sm:inline">df.info() · fillna() · drop_duplicates() · clip()</span>
            </div>
          </div>

          {pgOutput && (
            <div className="border border-neutral-700 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800">
                <span className="text-xs text-neutral-500 flex items-center gap-2 font-mono tracking-wider"><Terminal size={12} strokeWidth={1.5} />OUTPUT</span>
                <button onClick={() => setPgOutput('')} className="text-xs text-neutral-700 hover:text-white font-mono transition-colors duration-100">CLEAR</button>
              </div>
              <pre ref={outRef} className="p-4 text-xs text-neutral-300 font-mono overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed">{pgOutput}</pre>
            </div>
          )}

          {allDone && (
            <div className="mt-6 border-2 border-white p-8 text-center">
              <h3 className="text-2xl font-bold text-white mb-2" style={serif}>All Tasks Complete</h3>
              <p className="text-sm text-neutral-400 mb-4 font-mono">你已成功完成完整的数据清洗流程</p>
              <div className="border border-neutral-700 p-4 text-left inline-block mb-4">
                <div className="text-xs text-neutral-300 font-mono space-y-1">
                  <p>✓ df.info() — 数据全貌</p><p>✓ isnull().sum() — 缺失值</p><p>✓ drop_duplicates() — 去重</p><p>✓ fillna() — 填充</p><p>✓ str.replace() — 格式化</p><p>✓ clip() — 异常值</p>
                </div>
              </div>
              <div><button onClick={() => setView('menu')} className="px-8 py-3 bg-white text-black font-mono text-xs tracking-widest uppercase hover:bg-neutral-200 transition-colors duration-100">RETURN</button></div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========== WRONG BOOK ==========
  if (view === 'wrongBook') {
    const wrongList = Object.entries(wrongAns).map(([k, v]) => ({ key: k, ...v, lesson: lessons[v.li], question: lessons[v.li].questions[v.qi] }));
    return (
      <div className="min-h-screen bg-white p-6" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-8 pt-4">
            <button onClick={() => setView('menu')} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-black font-mono tracking-wider transition-colors duration-100"><ChevronLeft size={14} strokeWidth={1.5} />BACK</button>
            {wrongCount > 0 && <button onClick={() => setWrongAns({})} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-black font-mono transition-colors duration-100"><Trash2 size={12} strokeWidth={1.5} />CLEAR</button>}
          </div>

          <div className="text-center mb-8">
            <div className="h-1 bg-black w-12 mx-auto mb-6" />
            <h2 className="text-4xl font-bold text-black tracking-tight" style={serif}>错题集</h2>
            <p className="text-sm text-neutral-400 mt-2 font-mono">{wrongCount > 0 ? `${wrongCount} errors` : 'No errors'}</p>
          </div>

          {wrongCount === 0 ? (
            <div className="border-2 border-black p-12 text-center">
              <div className="text-3xl font-bold mb-2" style={serif}>—</div>
              <p className="text-sm text-neutral-500 font-mono">暂无错题，继续加油。</p>
            </div>
          ) : (
            <>
              {tagStats.length > 0 && (
                <div className="border border-black p-5 mb-6">
                  <h3 className="font-bold text-black text-sm mb-4 font-mono tracking-wider uppercase">Weak Points</h3>
                  {tagStats.map(([tag, cnt]) => {
                    const info = kpInfo[tag];
                    return (
                      <div key={tag} className="border-b border-neutral-200 last:border-b-0 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold text-black">{tag}</span>
                          <span className="text-xs font-mono bg-black text-white px-2 py-0.5">×{cnt}</span>
                        </div>
                        <p className="text-xs text-neutral-500">{info.tip}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mb-6">
                {wrongList.map(item => {
                  const exp = expCards[item.key];
                  return (
                    <div key={item.key} className="border border-black border-b-0 last:border-b overflow-hidden">
                      <button onClick={() => setExpCards(p => ({ ...p, [item.key]: !p[item.key] }))} className="w-full text-left p-4 hover:bg-neutral-50 transition-colors duration-100">
                        <div className="flex items-start gap-3">
                          <span className="text-xs font-mono text-neutral-300 mt-0.5">{String(item.li + 1).padStart(2, '0')}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-neutral-400 font-mono mb-0.5">{item.att > 1 && `×${item.att}`}</div>
                            <p className="text-sm text-black">{item.question.question}</p>
                          </div>
                          {exp ? <Minus size={14} strokeWidth={1.5} className="text-neutral-400 mt-1" /> : <ChevronDown size={14} strokeWidth={1.5} className="text-neutral-400 mt-1" />}
                        </div>
                      </button>
                      {exp && (
                        <div className="px-4 pb-4 border-t border-neutral-200 pt-3">
                          {item.question.code && <CodeBlock code={item.question.code} />}
                          <div className="space-y-1 mb-3">
                            {item.question.options.map((o, oi) => (
                              <div key={oi} className={`text-xs px-3 py-2 flex items-center gap-2 ${oi === item.question.correct ? 'bg-black text-white' : oi === item.sel ? 'bg-neutral-100 text-black' : 'text-neutral-400'}`}>
                                <span className={`w-4 h-4 flex items-center justify-center text-xs font-mono ${oi === item.question.correct ? 'text-white' : oi === item.sel ? 'text-black font-bold' : 'text-neutral-400'}`}>{String.fromCharCode(65 + oi)}</span>{o}
                              </div>
                            ))}
                          </div>
                          <div className="border-l-4 border-black pl-3 py-2"><p className="text-xs text-neutral-600 leading-relaxed">{item.question.explanation}</p></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button onClick={startRetry} className="w-full py-4 bg-black text-white font-mono text-xs tracking-widest uppercase hover:bg-white hover:text-black border-2 border-black transition-colors duration-100 flex items-center justify-center gap-2">
                <RefreshCw size={14} strokeWidth={1.5} />RETRY {wrongCount} QUESTIONS
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ========== RETRY ==========
  if (view === 'retry') {
    if (retryIdx >= retryKeys.length) {
      return (
        <div className="min-h-screen bg-white p-6 flex items-center justify-center" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
          <div className="max-w-md w-full text-center">
            <div className="h-1 bg-black w-12 mx-auto mb-8" />
            <h2 className="text-4xl font-bold text-black mb-4 tracking-tight" style={serif}>{retryOk === retryKeys.length ? 'Perfect' : 'Done'}</h2>
            <div className="border-2 border-black p-8 mb-6">
              <div className="text-5xl font-bold text-black" style={serif}>{retryOk}/{retryKeys.length}</div>
              <div className="text-xs text-neutral-400 mt-2 font-mono tracking-widest uppercase">Mastered</div>
            </div>
            {wrongCount > 0 && <p className="text-sm text-neutral-500 mb-6 font-mono">{wrongCount} remaining</p>}
            <div className="flex gap-0">
              <button onClick={() => setView('wrongBook')} className="flex-1 py-4 border-2 border-black text-black font-mono text-xs tracking-widest uppercase hover:bg-black hover:text-white transition-colors duration-100">ERRORS</button>
              <button onClick={() => setView('menu')} className="flex-1 py-4 bg-black text-white border-2 border-black font-mono text-xs tracking-widest uppercase hover:bg-white hover:text-black transition-colors duration-100">MENU</button>
            </div>
          </div>
        </div>
      );
    }
    const rKey = retryKeys[retryIdx];
    const rWa = wrongAns[rKey] || { li: +rKey.split('-')[0], qi: +rKey.split('-')[1] };
    const rL = lessons[rWa.li]; const rQ = rL.questions[rWa.qi];
    return (
      <div className="min-h-screen bg-white p-6" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6 pt-4">
            <button onClick={() => setView('wrongBook')} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-black font-mono tracking-wider transition-colors duration-100"><ChevronLeft size={14} strokeWidth={1.5} />EXIT</button>
            <span className="text-xs text-neutral-400 font-mono">{retryIdx + 1}/{retryKeys.length}</span>
          </div>
          <div className="flex gap-0.5 mb-6">{retryKeys.map((_, i) => <div key={i} className={`h-0.5 flex-1 ${i < retryIdx ? 'bg-black' : i === retryIdx ? 'bg-black' : 'bg-neutral-200'}`} />)}</div>
          <DataTable data={rL.data} />
          <div className="border border-black p-5 mb-4">
            <h3 className="font-bold text-black text-sm mb-4">{rQ.question}</h3>
            {rQ.code && <CodeBlock code={rQ.code} />}
            <div className="space-y-2">{rQ.options.map((o, i) => <OptBtn key={i} opt={o} i={i} q={rQ} sel={retrySel} show={retryExp} onSel={handleRetryAns} />)}</div>
            {retryExp && <ExpBox ok={retrySel === rQ.correct} text={rQ.explanation} />}
          </div>
          {retryExp && <button onClick={nextRetry} className="w-full py-4 bg-black text-white font-mono text-xs tracking-widest uppercase hover:bg-white hover:text-black border-2 border-black transition-colors duration-100">{retryIdx < retryKeys.length - 1 ? 'NEXT →' : 'RESULTS'}</button>}
        </div>
      </div>
    );
  }

  // ========== SUMMARY ==========
  if (view === 'summary') {
    const pct = totalAns > 0 ? Math.round((score / totalAns) * 100) : 0;
    return (
      <div className="min-h-screen bg-white p-6 flex items-center justify-center" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
        <div className="max-w-md w-full text-center">
          <div className="h-1 bg-black w-12 mx-auto mb-8" />
          <h2 className="text-4xl font-bold text-black tracking-tight mb-2" style={serif}>Complete</h2>
          <p className="text-neutral-400 text-sm font-mono mb-8">理论学习已完成</p>

          <div className="border-2 border-black p-8 mb-6">
            <div className="text-6xl font-bold text-black" style={serif}>{score}/{totalAns}</div>
            <div className="text-xs text-neutral-400 mt-3 font-mono tracking-widest uppercase">Accuracy {pct}%</div>
            <div className="h-1 w-full bg-neutral-100 mt-4"><div className="h-1 bg-black transition-all" style={{ width: `${pct}%` }} /></div>
          </div>

          {wrongCount > 0 && (
            <button onClick={() => setView('wrongBook')} className="w-full mb-3 py-4 border-2 border-black text-black font-mono text-xs tracking-widest uppercase hover:bg-black hover:text-white transition-colors duration-100 flex items-center justify-center gap-2">
              <BookMarked size={14} strokeWidth={1.5} />ERRORS ({wrongCount})
            </button>
          )}
          <button onClick={() => setView('playground')} className="w-full mb-3 py-4 bg-black text-white border-2 border-black font-mono text-xs tracking-widest uppercase hover:bg-white hover:text-black transition-colors duration-100 flex items-center justify-center gap-2">
            <Terminal size={14} strokeWidth={1.5} />PYTHON LAB →
          </button>
          <div className="flex gap-0">
            <button onClick={resetAll} className="flex-1 py-4 border-2 border-black text-black font-mono text-xs tracking-widest uppercase hover:bg-black hover:text-white transition-colors duration-100">RESET</button>
            <button onClick={() => setView('menu')} className="flex-1 py-4 border-2 border-l-0 border-black text-black font-mono text-xs tracking-widest uppercase hover:bg-black hover:text-white transition-colors duration-100">MENU</button>
          </div>
        </div>
      </div>
    );
  }

  // ========== LESSON ==========
  const dc = diffCfg[lesson.difficulty];
  return (
    <div className="min-h-screen bg-white p-6" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6 pt-4">
          <button onClick={() => setView('menu')} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-black font-mono tracking-wider transition-colors duration-100"><ChevronLeft size={14} strokeWidth={1.5} />BACK</button>
          <div className="flex items-center gap-4">
            {wrongCount > 0 && <button onClick={() => setView('wrongBook')} className="text-xs text-neutral-400 flex items-center gap-1 font-mono hover:text-black transition-colors duration-100"><BookMarked size={12} strokeWidth={1.5} />{wrongCount}</button>}
            <span className="text-xs text-neutral-400 font-mono">{score}/{totalAns}</span>
          </div>
        </div>

        <div className="flex gap-0.5 mb-8">{lessons.map((_, i) => <div key={i} className={`h-0.5 flex-1 ${i < curLesson ? 'bg-black' : i === curLesson ? 'bg-black' : 'bg-neutral-200'}`} />)}</div>

        <div className="mb-6">
          <div className="flex items-baseline gap-3 mb-1">
            <span className="text-xs text-neutral-400 font-mono tracking-widest uppercase">Lesson {String(curLesson + 1).padStart(2, '0')}</span>
            <span className={`text-xs font-mono ${dc.cls}`}>{dc.label}</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-black tracking-tight mb-3" style={serif}>{lesson.title}</h2>
          <p className="text-sm text-neutral-500 mb-4">{lesson.description}</p>
          <div className="border-l-4 border-black pl-4 py-2">
            <p className="text-xs text-neutral-600 leading-relaxed">{lesson.concept}</p>
          </div>
        </div>

        <Rule />
        <FuncRef functions={lesson.functions} />
        <DataTable data={lesson.data} />

        <div className="border border-black p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-neutral-400 font-mono tracking-wider">{curQ + 1} / {lesson.questions.length}</span>
            <div className="flex gap-1.5 flex-wrap justify-end">
              {question.tags.map(t => <span key={t} className="text-xs px-2 py-0.5 border border-neutral-300 text-neutral-500 font-mono">{t}</span>)}
            </div>
          </div>
          <h3 className="font-bold text-black text-sm mb-4 leading-relaxed">{question.question}</h3>
          {question.code && <CodeBlock code={question.code} />}
          <div className="space-y-2">{question.options.map((o, i) => <OptBtn key={i} opt={o} i={i} q={question} sel={selAns} show={showExp} onSel={handleAnswer} />)}</div>
          {showExp && <ExpBox ok={selAns === question.correct} text={question.explanation} />}
        </div>

        {showExp && (
          <button onClick={nextQ} className="w-full py-4 bg-black text-white border-2 border-black font-mono text-xs tracking-widest uppercase hover:bg-white hover:text-black transition-colors duration-100">
            {curQ < lesson.questions.length - 1 ? 'NEXT →' : curLesson < lessons.length - 1 ? 'NEXT LESSON →' : 'RESULTS'}
          </button>
        )}
      </div>
    </div>
  );
}
