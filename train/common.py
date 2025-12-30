import json
import sqlite3
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np
import pandas as pd


HORIZONS_MS: Dict[str, int] = {
    "60s": 60_000,
    "5m": 5 * 60_000,
    "1h": 60 * 60_000,
}


@dataclass(frozen=True)
class LoadedData:
    station_df: pd.DataFrame
    group_df: pd.DataFrame
    alarm_occurrences: pd.DataFrame


def _read_sql(conn: sqlite3.Connection, query: str, params: Sequence[Any] = ()) -> pd.DataFrame:
    return pd.read_sql_query(query, conn, params=params)


def load_data(
    db_path: str,
    start_ts: Optional[int] = None,
    end_ts: Optional[int] = None,
) -> LoadedData:
    conn = sqlite3.connect(db_path)
    try:
        where = []
        args: List[Any] = []
        if isinstance(start_ts, int):
            where.append("ts >= ?")
            args.append(start_ts)
        if isinstance(end_ts, int):
            where.append("ts <= ?")
            args.append(end_ts)
        where_sql = f"WHERE {' AND '.join(where)}" if where else ""

        telemetry = _read_sql(
            conn,
            f"SELECT ts, averageVoltage, totalCurrent, averageTemperature, systemSOC, systemSOH FROM telemetry {where_sql} ORDER BY ts ASC",
            args,
        )
        system_status = _read_sql(
            conn,
            f"SELECT ts, load, totalPower FROM system_status {where_sql} ORDER BY ts ASC",
            args,
        )
        alarm_snapshots = _read_sql(
            conn,
            f"SELECT ts, totalAlarms, criticalAlarms, warningAlarms, infoAlarms FROM alarm_snapshots {where_sql} ORDER BY ts ASC",
            args,
        )
        battery_groups = _read_sql(
            conn,
            f"SELECT ts, json FROM battery_groups_snapshots {where_sql} ORDER BY ts ASC",
            args,
        )
        coordination_units = _read_sql(
            conn,
            f"SELECT ts, json FROM coordination_units_snapshots {where_sql} ORDER BY ts ASC",
            args,
        )
        alarm_occurrences = _read_sql(
            conn,
            "SELECT ts, groupId, type, level FROM alarm_occurrences ORDER BY ts ASC",
        )

        station = (
            telemetry.merge(system_status, on="ts", how="outer")
            .merge(alarm_snapshots, on="ts", how="outer")
            .sort_values("ts")
            .reset_index(drop=True)
        )

        station_target = []
        for r in coordination_units.itertuples(index=False):
            try:
                units = json.loads(getattr(r, "json"))
                if isinstance(units, list) and units:
                    u0 = units[0] if isinstance(units[0], dict) else None
                    target = None
                    if isinstance(u0, dict):
                        target = (
                            ((u0.get("inputs") or {}).get("upper") or {}).get("targetPowerKw")
                        )
                    station_target.append(
                        {
                            "ts": int(getattr(r, "ts")),
                            "stationTargetPowerKw": _to_float(target),
                        }
                    )
                else:
                    station_target.append({"ts": int(getattr(r, "ts")), "stationTargetPowerKw": np.nan})
            except Exception:
                station_target.append({"ts": int(getattr(r, "ts")), "stationTargetPowerKw": np.nan})
        station_target_df = pd.DataFrame.from_records(station_target)
        station = station.merge(station_target_df, on="ts", how="outer").sort_values("ts")

        group_records: List[Dict[str, Any]] = []
        for r in battery_groups.itertuples(index=False):
            ts = int(getattr(r, "ts"))
            try:
                groups = json.loads(getattr(r, "json"))
            except Exception:
                continue
            if not isinstance(groups, list):
                continue
            for g in groups:
                if not isinstance(g, dict):
                    continue
                gid = g.get("id")
                if not isinstance(gid, int):
                    continue
                bms = g.get("bms") or {}
                pcs = g.get("pcs") or {}
                group_records.append(
                    {
                        "ts": ts,
                        "groupId": gid,
                        "bms_socPct": _to_float(bms.get("socPct")),
                        "bms_temperatureC": _to_float(bms.get("temperatureC")),
                        "bms_insulationResistanceKohm": _to_float(bms.get("insulationResistanceKohm")),
                        "bms_deltaCellVoltageMv": _to_float(bms.get("deltaCellVoltageMv")),
                        "bms_maxCellTempC": _to_float(bms.get("maxCellTempC")),
                        "bms_warningCount": _to_float(bms.get("warningCount")),
                        "bms_faultCount": _to_float(bms.get("faultCount")),
                        "pcs_setpointKw": _to_float(pcs.get("setpointKw")),
                        "pcs_actualKw": _to_float(pcs.get("actualKw")),
                        "pcs_temperature": _to_float(pcs.get("temperature")),
                        "pcs_dcVoltageV": _to_float(pcs.get("dcVoltageV")),
                        "pcs_dcCurrentA": _to_float(pcs.get("dcCurrentA")),
                        "pcs_efficiencyPct": _to_float(pcs.get("efficiencyPct")),
                    }
                )

        group_df = pd.DataFrame.from_records(group_records)
        if group_df.empty:
            group_df = pd.DataFrame(
                columns=[
                    "ts",
                    "groupId",
                    "bms_socPct",
                    "bms_temperatureC",
                    "bms_insulationResistanceKohm",
                    "bms_deltaCellVoltageMv",
                    "bms_maxCellTempC",
                    "bms_warningCount",
                    "bms_faultCount",
                    "pcs_setpointKw",
                    "pcs_actualKw",
                    "pcs_temperature",
                    "pcs_dcVoltageV",
                    "pcs_dcCurrentA",
                    "pcs_efficiencyPct",
                ]
            )

        station = station.sort_values("ts")
        group_df = group_df.sort_values(["groupId", "ts"])

        return LoadedData(station_df=station, group_df=group_df, alarm_occurrences=alarm_occurrences)
    finally:
        conn.close()


def _to_float(v: Any) -> float:
    try:
        n = float(v)
        if np.isfinite(n):
            return n
        return float("nan")
    except Exception:
        return float("nan")


def build_station_features(station_df: pd.DataFrame, group_df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    df = station_df.copy()
    df = df.sort_values("ts").reset_index(drop=True)
    df["dt"] = pd.to_datetime(df["ts"], unit="ms")
    df = df.set_index("dt")

    agg = (
        group_df.groupby("ts")
        .agg(
            groupSocAvg=("bms_socPct", "mean"),
            groupTempMax=("bms_temperatureC", "max"),
            groupInsuMin=("bms_insulationResistanceKohm", "min"),
            groupDeltaMax=("bms_deltaCellVoltageMv", "max"),
            groupPcsActualKwSum=("pcs_actualKw", "sum"),
        )
        .reset_index()
    )
    df = df.reset_index().merge(agg, on="ts", how="left").sort_values("ts")
    df["dt"] = pd.to_datetime(df["ts"], unit="ms")
    df = df.set_index("dt")

    base_cols = [
        "stationTargetPowerKw",
        "systemSOC",
        "systemSOH",
        "averageVoltage",
        "totalCurrent",
        "averageTemperature",
        "load",
        "totalPower",
        "totalAlarms",
        "criticalAlarms",
        "warningAlarms",
        "infoAlarms",
        "groupSocAvg",
        "groupTempMax",
        "groupInsuMin",
        "groupDeltaMax",
        "groupPcsActualKwSum",
    ]

    for c in base_cols:
        if c not in df.columns:
            df[c] = np.nan

    df[base_cols] = df[base_cols].ffill().bfill()

    feature_cols: List[str] = []
    for c in base_cols:
        df[f"{c}_diff1"] = df[c].diff()
        df[f"{c}_mean60s"] = df[c].rolling("60s").mean()
        df[f"{c}_std60s"] = df[c].rolling("60s").std()
        df[f"{c}_mean5m"] = df[c].rolling("5min").mean()
        df[f"{c}_std5m"] = df[c].rolling("5min").std()
        feature_cols.extend([f"{c}_diff1", f"{c}_mean60s", f"{c}_std60s", f"{c}_mean5m", f"{c}_std5m"])

    out = df.reset_index(drop=True)
    out = out.sort_values("ts").reset_index(drop=True)
    feature_cols = [c for c in feature_cols if c in out.columns]
    return out, feature_cols


def build_group_features(station_features_df: pd.DataFrame, group_df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    df = group_df.copy()
    df = df.sort_values(["groupId", "ts"]).reset_index(drop=True)
    df = df.merge(
        station_features_df[["ts", "stationTargetPowerKw", "systemSOC", "systemSOH", "load", "totalPower", "groupInsuMin", "groupDeltaMax", "groupTempMax", "groupSocAvg"]],
        on="ts",
        how="left",
    )

    df["dt"] = pd.to_datetime(df["ts"], unit="ms")
    df = df.set_index("dt")

    base_cols = [
        "groupId",
        "bms_socPct",
        "bms_temperatureC",
        "bms_insulationResistanceKohm",
        "bms_deltaCellVoltageMv",
        "bms_maxCellTempC",
        "bms_warningCount",
        "bms_faultCount",
        "pcs_setpointKw",
        "pcs_actualKw",
        "pcs_temperature",
        "pcs_dcVoltageV",
        "pcs_dcCurrentA",
        "pcs_efficiencyPct",
        "stationTargetPowerKw",
        "systemSOC",
        "systemSOH",
        "load",
        "totalPower",
        "groupInsuMin",
        "groupDeltaMax",
        "groupTempMax",
        "groupSocAvg",
    ]

    for c in base_cols:
        if c not in df.columns:
            df[c] = np.nan

    df[base_cols] = df.groupby("groupId")[base_cols].ffill().bfill()

    feature_cols: List[str] = ["groupId"]

    ts_groups = []
    for gid, g in df.groupby("groupId", sort=False):
        g = g.sort_index()
        for c in [
            "bms_socPct",
            "bms_temperatureC",
            "bms_insulationResistanceKohm",
            "bms_deltaCellVoltageMv",
            "bms_maxCellTempC",
            "pcs_actualKw",
            "pcs_setpointKw",
            "stationTargetPowerKw",
            "systemSOC",
            "load",
            "groupInsuMin",
            "groupDeltaMax",
            "groupTempMax",
            "groupSocAvg",
        ]:
            g[f"{c}_diff1"] = g[c].diff()
            g[f"{c}_mean60s"] = g[c].rolling("60s").mean()
            g[f"{c}_std60s"] = g[c].rolling("60s").std()
            g[f"{c}_mean5m"] = g[c].rolling("5min").mean()
            g[f"{c}_std5m"] = g[c].rolling("5min").std()
            feature_cols.extend([f"{c}_diff1", f"{c}_mean60s", f"{c}_std60s", f"{c}_mean5m", f"{c}_std5m"])
        ts_groups.append(g)

    if ts_groups:
        out = pd.concat(ts_groups, axis=0)
    else:
        out = df

    out = out.reset_index(drop=True).sort_values(["groupId", "ts"]).reset_index(drop=True)
    feature_cols = [c for c in dict.fromkeys(feature_cols).keys() if c in out.columns]
    return out, feature_cols


def add_future_targets_by_horizon(
    df: pd.DataFrame,
    horizons_ms: Dict[str, int],
    target_cols: List[str],
) -> pd.DataFrame:
    out = df.copy()
    out = out.sort_values(["groupId", "ts"]).reset_index(drop=True)

    for h_key, h_ms in horizons_ms.items():
        for col in target_cols:
            out[f"y_{col}_{h_key}"] = np.nan

        for gid, g in out.groupby("groupId", sort=False):
            ts = g["ts"].to_numpy(dtype=np.int64)
            idx = np.searchsorted(ts, ts + np.int64(h_ms), side="left")
            valid = idx < len(ts)
            for col in target_cols:
                vals = g[col].to_numpy(dtype=float)
                y = np.full(len(ts), np.nan)
                y[valid] = vals[idx[valid]]
                out.loc[g.index, f"y_{col}_{h_key}"] = y

    return out


def merge_risk_labels_from_future_counts(
    df: pd.DataFrame,
    horizons_ms: Dict[str, int],
) -> pd.DataFrame:
    """Merge risk labels derived from future BMS counters.

    This is a robust fallback when alarm_occurrences is sparse.
    - warning: future bms_warningCount > 0
    - fault: future bms_faultCount > 0

    The result is merged into existing y_warning_{h} / y_fault_{h} columns if present.
    """

    out = df.copy()
    out = out.sort_values(["groupId", "ts"]).reset_index(drop=True)

    for h_key, _h_ms in horizons_ms.items():
        if f"y_warning_{h_key}" not in out.columns:
            out[f"y_warning_{h_key}"] = 0
        if f"y_fault_{h_key}" not in out.columns:
            out[f"y_fault_{h_key}"] = 0

    for gid, g in out.groupby("groupId", sort=False):
        ts = g["ts"].to_numpy(dtype=np.int64)
        idx = {}
        for h_key, h_ms in horizons_ms.items():
            idx[h_key] = np.searchsorted(ts, ts + np.int64(h_ms), side="left")

        warn_cnt = g.get("bms_warningCount")
        fault_cnt = g.get("bms_faultCount")

        warn_vals = warn_cnt.to_numpy(dtype=float) if warn_cnt is not None else np.full(len(ts), np.nan)
        fault_vals = (
            fault_cnt.to_numpy(dtype=float) if fault_cnt is not None else np.full(len(ts), np.nan)
        )

        for h_key in horizons_ms.keys():
            j = idx[h_key]
            valid = j < len(ts)

            y_warn = np.zeros(len(ts), dtype=np.int32)
            y_fault = np.zeros(len(ts), dtype=np.int32)

            if valid.any():
                fut_warn = warn_vals[j[valid]]
                fut_fault = fault_vals[j[valid]]
                y_warn[valid] = (np.nan_to_num(fut_warn, nan=0.0) > 0).astype(np.int32)
                y_fault[valid] = (np.nan_to_num(fut_fault, nan=0.0) > 0).astype(np.int32)

            out.loc[g.index, f"y_warning_{h_key}"] = np.maximum(
                out.loc[g.index, f"y_warning_{h_key}"].to_numpy(dtype=np.int32),
                y_warn,
            )
            out.loc[g.index, f"y_fault_{h_key}"] = np.maximum(
                out.loc[g.index, f"y_fault_{h_key}"].to_numpy(dtype=np.int32),
                y_fault,
            )

    return out


def add_warning_labels_by_horizon(
    df: pd.DataFrame,
    alarm_occurrences: pd.DataFrame,
    horizons_ms: Dict[str, int],
) -> pd.DataFrame:
    out = df.copy()
    occ = alarm_occurrences.copy()
    if not occ.empty:
        occ = occ[(occ["groupId"].notna())]
        occ["groupId"] = occ["groupId"].astype(int)
        occ["ts"] = occ["ts"].astype(int)

    event_ts_by_group: Dict[int, np.ndarray] = {}
    if not occ.empty:
        is_warning = occ["level"].isin(["warning"])
        warn_occ = occ[is_warning]
        for gid, g in warn_occ.groupby("groupId"):
            arr = np.sort(g["ts"].to_numpy(dtype=np.int64))
            event_ts_by_group[int(gid)] = arr

    for h_key, _h_ms in horizons_ms.items():
        out[f"y_warning_{h_key}"] = 0

    for gid, g in out.groupby("groupId", sort=False):
        ts = g["ts"].to_numpy(dtype=np.int64)
        events = event_ts_by_group.get(int(gid), np.array([], dtype=np.int64))
        if events.size == 0:
            continue
        for h_key, h_ms in horizons_ms.items():
            idx = np.searchsorted(events, ts, side="right")
            has = np.zeros(len(ts), dtype=np.int32)
            mask = idx < len(events)
            has[mask] = (events[idx[mask]] <= (ts[mask] + np.int64(h_ms))).astype(np.int32)
            out.loc[g.index, f"y_warning_{h_key}"] = has

    return out


def add_fault_labels_by_horizon(
    df: pd.DataFrame,
    alarm_occurrences: pd.DataFrame,
    horizons_ms: Dict[str, int],
) -> pd.DataFrame:
    out = df.copy()
    occ = alarm_occurrences.copy()
    if not occ.empty:
        occ = occ[(occ["groupId"].notna())]
        occ["groupId"] = occ["groupId"].astype(int)
        occ["ts"] = occ["ts"].astype(int)

    event_ts_by_group: Dict[int, np.ndarray] = {}
    if not occ.empty:
        is_fault = (occ["level"].isin(["critical"])) | (occ["type"].astype(str) == "锁存")
        fault_occ = occ[is_fault]
        for gid, g in fault_occ.groupby("groupId"):
            arr = np.sort(g["ts"].to_numpy(dtype=np.int64))
            event_ts_by_group[int(gid)] = arr

    for h_key, h_ms in horizons_ms.items():
        out[f"y_fault_{h_key}"] = 0

    for gid, g in out.groupby("groupId", sort=False):
        ts = g["ts"].to_numpy(dtype=np.int64)
        events = event_ts_by_group.get(int(gid), np.array([], dtype=np.int64))
        if events.size == 0:
            continue
        for h_key, h_ms in horizons_ms.items():
            idx = np.searchsorted(events, ts, side="right")
            has = np.zeros(len(ts), dtype=np.int32)
            mask = idx < len(events)
            has[mask] = (events[idx[mask]] <= (ts[mask] + np.int64(h_ms))).astype(np.int32)
            out.loc[g.index, f"y_fault_{h_key}"] = has

    return out


def latest_features_for_inference(
    station_features_df: pd.DataFrame,
    group_features_df: pd.DataFrame,
    station_feature_cols: List[str],
    group_feature_cols: List[str],
) -> Tuple[pd.DataFrame, pd.DataFrame, int]:
    if station_features_df.empty:
        return (
            pd.DataFrame(columns=["ts"] + station_feature_cols),
            pd.DataFrame(columns=["ts", "groupId"] + group_feature_cols),
            0,
        )

    latest_ts = int(station_features_df["ts"].max())
    station_row = station_features_df[station_features_df["ts"] == latest_ts].tail(1)

    g = group_features_df[group_features_df["ts"] == latest_ts]
    if g.empty:
        latest_ts = int(group_features_df["ts"].max()) if not group_features_df.empty else latest_ts
        station_row = station_features_df[station_features_df["ts"] <= latest_ts].tail(1)
        g = group_features_df[group_features_df["ts"] == latest_ts]

    station_x = station_row[["ts"] + station_feature_cols].copy()
    group_cols = ["ts"]
    if "groupId" not in group_feature_cols:
        group_cols.append("groupId")
    group_cols.extend(group_feature_cols)
    group_cols = list(dict.fromkeys(group_cols))
    group_x = g[group_cols].copy()
    return station_x, group_x, latest_ts
