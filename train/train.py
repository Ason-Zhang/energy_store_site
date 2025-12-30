import argparse
import json
import os
import time
from typing import Any, Dict, List, Tuple

import joblib
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, roc_auc_score

from common import (
    HORIZONS_MS,
    add_fault_labels_by_horizon,
    add_warning_labels_by_horizon,
    merge_risk_labels_from_future_counts,
    add_future_targets_by_horizon,
    build_group_features,
    build_station_features,
    load_data,
)


def _safe_auc(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    try:
        if len(np.unique(y_true)) < 2:
            return float("nan")
        return float(roc_auc_score(y_true, y_prob))
    except Exception:
        return float("nan")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=os.path.join("server", "data", "energy-monitor.db"))
    ap.add_argument("--out", default=os.path.join("train", "artifacts"))
    ap.add_argument("--window-hours", type=float, default=12.0)
    args = ap.parse_args()

    db_path = args.db
    out_dir = args.out
    os.makedirs(out_dir, exist_ok=True)

    end_ts = None
    start_ts = None
    if args.window_hours and args.window_hours > 0:
        end_ts = None
        start_ts = int(time.time() * 1000) - int(args.window_hours * 60 * 60 * 1000)

    loaded = load_data(db_path, start_ts=start_ts, end_ts=end_ts)

    station_feat_df, station_feature_cols = build_station_features(loaded.station_df, loaded.group_df)
    group_feat_df, group_feature_cols = build_group_features(station_feat_df, loaded.group_df)

    group_targets = [
        "bms_socPct",
        "bms_temperatureC",
        "bms_insulationResistanceKohm",
        "bms_deltaCellVoltageMv",
        "pcs_actualKw",
    ]

    station_targets = ["stationTargetPowerKw"]

    group_all = add_future_targets_by_horizon(group_feat_df, HORIZONS_MS, group_targets)
    group_all = add_fault_labels_by_horizon(group_all, loaded.alarm_occurrences, HORIZONS_MS)
    group_all = add_warning_labels_by_horizon(group_all, loaded.alarm_occurrences, HORIZONS_MS)
    group_all = merge_risk_labels_from_future_counts(group_all, HORIZONS_MS)

    station_all = station_feat_df.copy().sort_values("ts").reset_index(drop=True)
    for h_key, h_ms in HORIZONS_MS.items():
        for col in station_targets:
            y = np.full(len(station_all), np.nan)
            ts = station_all["ts"].to_numpy(dtype=np.int64)
            idx = np.searchsorted(ts, ts + np.int64(h_ms), side="left")
            valid = idx < len(ts)
            vals = station_all[col].to_numpy(dtype=float)
            y[valid] = vals[idx[valid]]
            station_all[f"y_{col}_{h_key}"] = y

    artifacts: Dict[str, Any] = {
        "trained_at_ms": int(time.time() * 1000),
        "db_path": db_path,
        "horizons_ms": HORIZONS_MS,
        "station_feature_cols": station_feature_cols,
        "group_feature_cols": group_feature_cols,
        "models": {"station": {}, "group": {}, "fault": {}, "warning": {}},
        "metrics": {"station": {}, "group": {}, "fault": {}, "warning": {}},
    }

    station_x = station_all[station_feature_cols].to_numpy(dtype=float)

    for h_key in HORIZONS_MS.keys():
        y_col = f"y_stationTargetPowerKw_{h_key}"
        y = station_all[y_col].to_numpy(dtype=float)
        mask = np.isfinite(y)
        if mask.sum() < 50:
            continue
        model = HistGradientBoostingRegressor(max_depth=6, random_state=0)
        model.fit(station_x[mask], y[mask])
        pred = model.predict(station_x[mask])
        mae = float(mean_absolute_error(y[mask], pred))
        artifacts["models"]["station"][h_key] = model
        artifacts["metrics"]["station"][h_key] = {"mae": mae, "n": int(mask.sum())}

    group_x = group_all[group_feature_cols].to_numpy(dtype=float)

    for h_key in HORIZONS_MS.keys():
        artifacts["models"]["group"][h_key] = {}
        artifacts["metrics"]["group"][h_key] = {}
        for col in group_targets:
            y_col = f"y_{col}_{h_key}"
            y = group_all[y_col].to_numpy(dtype=float)
            mask = np.isfinite(y)
            if mask.sum() < 200:
                continue
            model = HistGradientBoostingRegressor(max_depth=6, random_state=0)
            model.fit(group_x[mask], y[mask])
            pred = model.predict(group_x[mask])
            mae = float(mean_absolute_error(y[mask], pred))
            artifacts["models"]["group"][h_key][col] = model
            artifacts["metrics"]["group"][h_key][col] = {"mae": mae, "n": int(mask.sum())}

        mask_all = np.isfinite(group_x).all(axis=1)
        if mask_all.sum() < 200:
            continue

        y_fault = group_all[f"y_fault_{h_key}"].to_numpy(dtype=int)
        if len(np.unique(y_fault[mask_all])) >= 2:
            clf_fault = HistGradientBoostingClassifier(max_depth=6, random_state=0)
            clf_fault.fit(group_x[mask_all], y_fault[mask_all])
            prob_fault = clf_fault.predict_proba(group_x[mask_all])[:, 1]
            auc_fault = _safe_auc(y_fault[mask_all], prob_fault)
            artifacts["models"]["fault"][h_key] = clf_fault
            artifacts["metrics"]["fault"][h_key] = {"auc": auc_fault, "n": int(mask_all.sum())}

        y_warn = group_all[f"y_warning_{h_key}"].to_numpy(dtype=int)
        if len(np.unique(y_warn[mask_all])) >= 2:
            clf_warn = HistGradientBoostingClassifier(max_depth=6, random_state=0)
            clf_warn.fit(group_x[mask_all], y_warn[mask_all])
            prob_warn = clf_warn.predict_proba(group_x[mask_all])[:, 1]
            auc_warn = _safe_auc(y_warn[mask_all], prob_warn)
            artifacts["models"]["warning"][h_key] = clf_warn
            artifacts["metrics"]["warning"][h_key] = {"auc": auc_warn, "n": int(mask_all.sum())}

    model_path = os.path.join(out_dir, "model.joblib")
    joblib.dump(artifacts, model_path)

    meta_path = os.path.join(out_dir, "metrics.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(artifacts["metrics"], f, ensure_ascii=False, indent=2)

    print(json.dumps({"ok": True, "model_path": model_path, "metrics_path": meta_path}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
