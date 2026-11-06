/**
 * @Author wei
 * @Date 2026-11-06
 * @Description 日期与时间戳多格式智能解析与双向转换工具库，支持毫秒级、秒级、微秒级、ISO 8601、SQL 常用格式及相对时间计算
 **/

export interface ConvertedDateFormats {
  date: Date;
  detectedType: string;
  localStandard: string;    // YYYY-MM-DD HH:mm:ss
  localDate: string;        // YYYY-MM-DD
  localTime: string;        // HH:mm:ss
  unixSeconds: string;      // 10位时间戳
  unixMillis: string;       // 13位毫秒时间戳
  isoLocal: string;         // 带本地时区偏移的 ISO 8601
  isoUtc: string;           // 标准 UTC ISO 8601
  sqlFormat: string;        // YYYY-MM-DD HH:mm:ss.SSS
  rfc7231: string;          // HTTP Header 格式 (toUTCString)
  relative: string;         // 相对时间（刚刚/X分钟前/X天前等）
  timezoneName: string;     // 本地时区（如 Asia/Shanghai）
  timezoneOffset: string;   // 时区偏移（如 UTC+08:00）
}

// 补零工具
export const padZero = (n: number, len = 2): string => {
  return String(n).padStart(len, "0");
};

// 格式化为本地标准 YYYY-MM-DD HH:mm:ss
export const formatLocalStandard = (date: Date): string => {
  const y = date.getFullYear();
  const m = padZero(date.getMonth() + 1);
  const d = padZero(date.getDate());
  const h = padZero(date.getHours());
  const min = padZero(date.getMinutes());
  const s = padZero(date.getSeconds());
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
};

// 获取本地时区偏移字符串（如 +08:00 或 -05:00）
export const getTimezoneOffsetStr = (date: Date): string => {
  const offsetMinutes = -date.getTimezoneOffset(); // 注意：getTimezoneOffset 返回相反符号
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absMins = Math.abs(offsetMinutes);
  const hours = padZero(Math.floor(absMins / 60));
  const mins = padZero(absMins % 60);
  return `UTC${sign}${hours}:${mins}`;
};

// 生成带本地偏移的 ISO 8601 字符串
export const formatIsoLocal = (date: Date): string => {
  const y = date.getFullYear();
  const m = padZero(date.getMonth() + 1);
  const d = padZero(date.getDate());
  const h = padZero(date.getHours());
  const min = padZero(date.getMinutes());
  const s = padZero(date.getSeconds());
  const ms = padZero(date.getMilliseconds(), 3);
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absMins = Math.abs(offsetMinutes);
  const oh = padZero(Math.floor(absMins / 60));
  const om = padZero(absMins % 60);
  return `${y}-${m}-${d}T${h}:${min}:${s}.${ms}${sign}${oh}:${om}`;
};

// 计算相对人类可读时间
export const formatRelativeTime = (date: Date): string => {
  const now = Date.now();
  const target = date.getTime();
  const diffSec = Math.round((target - now) / 1000);
  const isFuture = diffSec > 0;
  const absSec = Math.abs(diffSec);

  if (absSec < 5) return "刚刚";
  if (absSec < 60) return isFuture ? `${absSec} 秒后` : `${absSec} 秒前`;
  const absMin = Math.floor(absSec / 60);
  if (absMin < 60) return isFuture ? `${absMin} 分钟后` : `${absMin} 分钟前`;
  const absHours = Math.floor(absMin / 60);
  if (absHours < 24) return isFuture ? `${absHours} 小时后` : `${absHours} 小时前`;
  const absDays = Math.floor(absHours / 24);
  if (absDays < 30) return isFuture ? `${absDays} 天后` : `${absDays} 天前`;
  const absMonths = Math.floor(absDays / 30);
  if (absMonths < 12) return isFuture ? `${absMonths} 个月后` : `${absMonths} 个月前`;
  const absYears = Math.floor(absDays / 365);
  return isFuture ? `${absYears} 年后` : `${absYears} 年前`;
};

/**
 * 智能解析任意输入为有效 Date 对象并识别其类型
 */
export const parseAnyDateInput = (
  input: string | number | Date | null | undefined
): { date: Date; detectedType: string } | null => {
  if (input === null || input === undefined) {
    return { date: new Date(), detectedType: "当前系统时间 (Now)" };
  }

  if (input instanceof Date) {
    if (!isNaN(input.getTime())) {
      return { date: input, detectedType: "Date 对象" };
    }
    return null;
  }

  if (typeof input === "number") {
    // 纯数字判断
    return parseNumericTimestamp(input);
  }

  const str = String(input).trim();
  if (!str || str.toLowerCase() === "now") {
    return { date: new Date(), detectedType: "当前系统时间 (Now)" };
  }

  // 1. 尝试匹配纯数字（时间戳）
  if (/^\d+$/.test(str)) {
    const num = Number(str);
    return parseNumericTimestamp(num);
  }

  // 2. 尝试解析常见格式：YYYY-MM-DD 或 YYYY/MM/DD 或带时分秒
  const standardDateMatch = str.match(
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d{1,3}))?)?)?$/
  );
  if (standardDateMatch) {
    const [, y, m, d, h, min, s, ms] = standardDateMatch;
    const year = parseInt(y, 10);
    const month = parseInt(m, 10) - 1;
    const day = parseInt(d, 10);
    const hour = h ? parseInt(h, 10) : 0;
    const minute = min ? parseInt(min, 10) : 0;
    const second = s ? parseInt(s, 10) : 0;
    const millis = ms ? parseInt(ms.padEnd(3, "0"), 10) : 0;

    const parsed = new Date(year, month, day, hour, minute, second, millis);
    if (!isNaN(parsed.getTime())) {
      const typeLabel = h ? "标准日期时间 (Local)" : "标准日期 (Local)";
      return { date: parsed, detectedType: typeLabel };
    }
  }

  // 3. 尝试直接以 ISO 8601 或标准字符串解析
  const dateObj = new Date(str);
  if (!isNaN(dateObj.getTime())) {
    if (str.includes("Z") || str.includes("+") || str.includes("-")) {
      return { date: dateObj, detectedType: "ISO 8601 / RFC 3339" };
    }
    return { date: dateObj, detectedType: "标准日期字符串" };
  }

  return null;
};

// 内部数字时间戳解析辅助
const parseNumericTimestamp = (
  num: number
): { date: Date; detectedType: string } | null => {
  const len = String(Math.floor(num)).length;

  if (len <= 10) {
    // 10位或以内按秒处理
    const d = new Date(num * 1000);
    if (!isNaN(d.getTime())) {
      return { date: d, detectedType: "Unix 秒级时间戳 (10位)" };
    }
  } else if (len <= 13) {
    // 13位按毫秒处理
    const d = new Date(num);
    if (!isNaN(d.getTime())) {
      return { date: d, detectedType: "Unix 毫秒时间戳 (13位)" };
    }
  } else if (len <= 16) {
    // 16位按微秒处理
    const d = new Date(Math.floor(num / 1000));
    if (!isNaN(d.getTime())) {
      return { date: d, detectedType: "Unix 微秒时间戳 (16位)" };
    }
  }

  const fallback = new Date(num);
  if (!isNaN(fallback.getTime())) {
    return { date: fallback, detectedType: "数值型时间戳" };
  }
  return null;
};

/**
 * 将 Date 转化为全套多格式输出
 */
export const convertDateToAllFormats = (
  date: Date,
  detectedType = "已解析"
): ConvertedDateFormats => {
  const y = date.getFullYear();
  const m = padZero(date.getMonth() + 1);
  const d = padZero(date.getDate());
  const h = padZero(date.getHours());
  const min = padZero(date.getMinutes());
  const s = padZero(date.getSeconds());
  const ms = padZero(date.getMilliseconds(), 3);

  const localStandard = `${y}-${m}-${d} ${h}:${min}:${s}`;
  const localDate = `${y}-${m}-${d}`;
  const localTime = `${h}:${min}:${s}`;
  const unixSeconds = String(Math.floor(date.getTime() / 1000));
  const unixMillis = String(date.getTime());
  const isoLocal = formatIsoLocal(date);
  const isoUtc = date.toISOString();
  const sqlFormat = `${y}-${m}-${d} ${h}:${min}:${s}.${ms}`;
  const rfc7231 = date.toUTCString();
  const relative = formatRelativeTime(date);

  let timezoneName = "Local";
  try {
    timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
  } catch {}

  const timezoneOffset = getTimezoneOffsetStr(date);

  return {
    date,
    detectedType,
    localStandard,
    localDate,
    localTime,
    unixSeconds,
    unixMillis,
    isoLocal,
    isoUtc,
    sqlFormat,
    rfc7231,
    relative,
    timezoneName,
    timezoneOffset,
  };
};

/**
 * 常用时间快捷辅助生成
 */
export const getTodayStart = (baseDate = new Date()): Date => {
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getTodayEnd = (baseDate = new Date()): Date => {
  const d = new Date(baseDate);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const addHours = (baseDate: Date, hours: number): Date => {
  const d = new Date(baseDate);
  d.setHours(d.getHours() + hours);
  return d;
};

export const addDays = (baseDate: Date, days: number): Date => {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + days);
  return d;
};
