/**
 * @Author wei
 * @Date 2026-11-04
 * @Description WorkPet 核心嵌入式数据库存储模块，基于纯 Go SQLite (modernc.org/sqlite) 实现，负责多工具数据持久化与历史聚合统计
 **/

package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"

	_ "modernc.org/sqlite"
)

// DailyActivity 今日活动与专注度统计持久化模型
type DailyActivity struct {
	Date               string  `json:"date"`               // YYYY-MM-DD
	FocusSeconds       int     `json:"focusSeconds"`       // 累计专注秒数
	RestSeconds        int     `json:"restSeconds"`        // 累计休息秒数
	RestCount          int     `json:"restCount"`          // 休息完成次数
	HourlyFocusSeconds [24]int `json:"hourlyFocusSeconds"` // 24小时各小时秒数
	UpdatedAt          string  `json:"updatedAt"`
}

// DB 数据库统一操作句柄
type DB struct {
	db *sql.DB
	mu sync.RWMutex
}

// InitDB 初始化本地 SQLite 数据库，并自动执行 Schema 迁移
func InitDB() (*DB, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = "."
	}
	dbDir := filepath.Join(homeDir, ".workpet")
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		return nil, fmt.Errorf("创建数据库目录失败: %w", err)
	}

	dbPath := filepath.Join(dbDir, "workpet.db")
	dsn := fmt.Sprintf("%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)", dbPath)

	conn, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("打开 SQLite 数据库失败: %w", err)
	}

	// 设置连接池参数
	conn.SetMaxOpenConns(1) // SQLite 嵌入式建议单写连接保障并发事务安全
	conn.SetMaxIdleConns(1)
	conn.SetConnMaxLifetime(0)

	instance := &DB{db: conn}
	if err := instance.migrate(); err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("数据库表结构迁移失败: %w", err)
	}

	log.Printf("[Storage] SQLite 数据库已就绪: %s (WAL 模式)", dbPath)
	return instance, nil
}

// migrate 执行建表与索引
func (d *DB) migrate() error {
	schema := `
	-- 每日工作与作息汇总表
	CREATE TABLE IF NOT EXISTS daily_activity_stats (
		date TEXT PRIMARY KEY,
		focus_seconds INTEGER NOT NULL DEFAULT 0,
		rest_seconds INTEGER NOT NULL DEFAULT 0,
		rest_count INTEGER NOT NULL DEFAULT 0,
		hourly_focus_json TEXT NOT NULL DEFAULT '[]',
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	-- 专注会话流水表（为番茄钟/单次专注分析预留底座）
	CREATE TABLE IF NOT EXISTS focus_sessions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		start_time DATETIME NOT NULL,
		end_time DATETIME,
		duration_seconds INTEGER DEFAULT 0,
		tool_id TEXT DEFAULT 'activity',
		status TEXT DEFAULT 'completed',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`
	_, err := d.db.Exec(schema)
	return err
}

// GetDailyActivity 获取指定日期的活动统计数据
func (d *DB) GetDailyActivity(date string) (*DailyActivity, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	query := `SELECT date, focus_seconds, rest_seconds, rest_count, hourly_focus_json, updated_at FROM daily_activity_stats WHERE date = ?`
	row := d.db.QueryRow(query, date)

	var item DailyActivity
	var hourlyJSON string
	err := row.Scan(&item.Date, &item.FocusSeconds, &item.RestSeconds, &item.RestCount, &hourlyJSON, &item.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // 当天暂无数据
		}
		return nil, err
	}

	var hourly [24]int
	if err := json.Unmarshal([]byte(hourlyJSON), &hourly); err == nil {
		item.HourlyFocusSeconds = hourly
	}

	return &item, nil
}

// SaveDailyActivity 保存或更新某一天的活动统计数据（Upsert）
func (d *DB) SaveDailyActivity(item *DailyActivity) error {
	if item == nil || item.Date == "" {
		return nil
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	hourlyBytes, err := json.Marshal(item.HourlyFocusSeconds)
	if err != nil {
		hourlyBytes = []byte("[]")
	}

	query := `
	INSERT INTO daily_activity_stats (date, focus_seconds, rest_seconds, rest_count, hourly_focus_json, updated_at)
	VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
	ON CONFLICT(date) DO UPDATE SET
		focus_seconds = excluded.focus_seconds,
		rest_seconds = excluded.rest_seconds,
		rest_count = excluded.rest_count,
		hourly_focus_json = excluded.hourly_focus_json,
		updated_at = excluded.updated_at;
	`

	_, err = d.db.Exec(query, item.Date, item.FocusSeconds, item.RestSeconds, item.RestCount, string(hourlyBytes))
	return err
}

// GetRecentDailyActivities 获取最近 N 天的历史数据列表（按日期倒序）
func (d *DB) GetRecentDailyActivities(days int) ([]DailyActivity, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	query := `
	SELECT date, focus_seconds, rest_seconds, rest_count, hourly_focus_json, updated_at
	FROM daily_activity_stats
	ORDER BY date DESC
	LIMIT ?
	`
	rows, err := d.db.Query(query, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []DailyActivity
	for rows.Next() {
		var item DailyActivity
		var hourlyJSON string
		if err := rows.Scan(&item.Date, &item.FocusSeconds, &item.RestSeconds, &item.RestCount, &hourlyJSON, &item.UpdatedAt); err != nil {
			continue
		}
		var hourly [24]int
		if err := json.Unmarshal([]byte(hourlyJSON), &hourly); err == nil {
			item.HourlyFocusSeconds = hourly
		}
		result = append(result, item)
	}

	return result, nil
}

// Close 安全关闭数据库连接
func (d *DB) Close() error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.db != nil {
		return d.db.Close()
	}
	return nil
}
