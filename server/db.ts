import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'

export type Db = InstanceType<typeof Database>

export function openDb(dbFilePath: string): Db {
  fs.mkdirSync(path.dirname(dbFilePath), { recursive: true })
  const db = new Database(dbFilePath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db
}

export function migrate(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      ts INTEGER PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS system_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL REFERENCES snapshots(ts) ON DELETE CASCADE,
      status TEXT NOT NULL,
      load INTEGER NOT NULL,
      totalPower INTEGER NOT NULL,
      runTime TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_system_status_ts ON system_status(ts);

    CREATE TABLE IF NOT EXISTS telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL REFERENCES snapshots(ts) ON DELETE CASCADE,
      currentTime TEXT NOT NULL,
      averageVoltage REAL NOT NULL,
      totalCurrent REAL NOT NULL,
      averageTemperature INTEGER NOT NULL,
      systemSOC INTEGER NOT NULL,
      systemSOH INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_telemetry_ts ON telemetry(ts);

    CREATE TABLE IF NOT EXISTS alarm_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL REFERENCES snapshots(ts) ON DELETE CASCADE,
      totalAlarms INTEGER NOT NULL,
      criticalAlarms INTEGER NOT NULL,
      warningAlarms INTEGER NOT NULL,
      infoAlarms INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_alarm_snapshots_ts ON alarm_snapshots(ts);

    CREATE TABLE IF NOT EXISTS alarms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_ts INTEGER NOT NULL REFERENCES snapshots(ts) ON DELETE CASCADE,
      timestamp TEXT NOT NULL,
      device TEXT NOT NULL,
      type TEXT NOT NULL,
      level TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_alarms_snapshot_ts ON alarms(snapshot_ts);

    CREATE TABLE IF NOT EXISTS device_telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL REFERENCES snapshots(ts) ON DELETE CASCADE,
      deviceType TEXT NOT NULL,
      deviceId INTEGER NOT NULL,
      voltage REAL NOT NULL,
      current REAL NOT NULL,
      temperature INTEGER NOT NULL,
      soc INTEGER NOT NULL,
      soh INTEGER NOT NULL,
      power REAL NOT NULL,
      chargingStatus TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_device_telemetry_lookup ON device_telemetry(deviceType, deviceId, ts);

    CREATE TABLE IF NOT EXISTS communication (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL REFERENCES snapshots(ts) ON DELETE CASCADE,
      deviceType TEXT NOT NULL,
      deviceId TEXT NOT NULL,
      status TEXT NOT NULL,
      lastCommTime TEXT NOT NULL,
      modbusPacketsJson TEXT NOT NULL,
      connectedDevicesJson TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_communication_lookup ON communication(deviceType, deviceId, ts);

    CREATE TABLE IF NOT EXISTS comm_links (
      key TEXT PRIMARY KEY,
      protocol TEXT NOT NULL,
      aType TEXT NOT NULL,
      aId TEXT NOT NULL,
      aName TEXT NOT NULL,
      bType TEXT NOT NULL,
      bId TEXT NOT NULL,
      bName TEXT NOT NULL,
      primaryFrom TEXT,
      primaryTo TEXT
    );

    CREATE TABLE IF NOT EXISTS comm_frames (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL REFERENCES snapshots(ts) ON DELETE CASCADE,
      linkKey TEXT NOT NULL,
      protocol TEXT NOT NULL,
      direction TEXT NOT NULL,
      fromDevice TEXT NOT NULL,
      toDevice TEXT NOT NULL,
      ok INTEGER NOT NULL,
      status TEXT NOT NULL,
      latencyMs INTEGER NOT NULL,
      bytes INTEGER NOT NULL,
      summary TEXT NOT NULL,
      payloadHex TEXT NOT NULL,
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_comm_frames_ts ON comm_frames(ts DESC);
    CREATE INDEX IF NOT EXISTS idx_comm_frames_link_ts ON comm_frames(linkKey, ts DESC);
    CREATE INDEX IF NOT EXISTS idx_comm_frames_from_ts ON comm_frames(fromDevice, ts DESC);
    CREATE INDEX IF NOT EXISTS idx_comm_frames_to_ts ON comm_frames(toDevice, ts DESC);

    CREATE TABLE IF NOT EXISTS control_commands (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      ts INTEGER NOT NULL,
      json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS control_command_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      actor TEXT NOT NULL,
      username TEXT,
      ip TEXT,
      json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_control_command_logs_ts ON control_command_logs(ts DESC);

    CREATE TABLE IF NOT EXISTS alarm_occurrences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      groupId INTEGER,
      source TEXT NOT NULL,
      device TEXT NOT NULL,
      type TEXT NOT NULL,
      level TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_alarm_occurrences_ts ON alarm_occurrences(ts DESC);
    CREATE INDEX IF NOT EXISTS idx_alarm_occurrences_group_ts ON alarm_occurrences(groupId, ts DESC);

    CREATE TABLE IF NOT EXISTS battery_latches (
      groupId INTEGER PRIMARY KEY,
      latched INTEGER NOT NULL,
      latchedAt INTEGER,
      reason TEXT,
      lastResetAt INTEGER,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scada_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      groupId INTEGER,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      acknowledged INTEGER NOT NULL,
      metaJson TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scada_notifications_ts ON scada_notifications(ts DESC);

    CREATE TABLE IF NOT EXISTS battery_groups_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL REFERENCES snapshots(ts) ON DELETE CASCADE,
      json TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_battery_groups_snapshots_ts ON battery_groups_snapshots(ts);

    CREATE TABLE IF NOT EXISTS coordination_units_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL REFERENCES snapshots(ts) ON DELETE CASCADE,
      json TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_coordination_units_snapshots_ts ON coordination_units_snapshots(ts);

    CREATE TABLE IF NOT EXISTS ems_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL REFERENCES snapshots(ts) ON DELETE CASCADE,
      json TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ems_snapshots_ts ON ems_snapshots(ts);

    CREATE TABLE IF NOT EXISTS front_server_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL REFERENCES snapshots(ts) ON DELETE CASCADE,
      json TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_front_server_snapshots_ts ON front_server_snapshots(ts);
  `)

  try {
    db.exec(`ALTER TABLE control_commands ADD COLUMN actor TEXT`)
  } catch (e) {
    void e
  }

  try {
    db.exec(`ALTER TABLE control_commands ADD COLUMN username TEXT`)
  } catch (e) {
    void e
  }
}
