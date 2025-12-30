import argparse
import json
import os
import time
from typing import Any, Dict, List, Tuple

import joblib
import numpy as np

from common import (
    HORIZONS_MS,
    build_group_features,
    build_station_features,
    latest_features_for_inference,
    load_data,
)


def _ensure_columns(df, cols):
    for c in cols:
        if c not in df.columns:
            df[c] = np.nan
    return df

def _to_py(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, (np.floating, np.integer)):
        if not np.isfinite(v):
            return None
        return v.item()
    if isinstance(v, float):
        if not np.isfinite(v):
            return None
        return v
    return v


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=os.path.join("server", "data", "energy-monitor.db"))
    ap.add_argument("--model", default=os.path.join("train", "artifacts", "model.joblib"))
    ap.add_argument("--out", default=os.path.join("server", "data", "predictions-latest.json"))
    ap.add_argument("--window-hours", type=float, default=12.0)
    args = ap.parse_args()

    artifacts = joblib.load(args.model)

    station_feature_cols = list(artifacts.get("station_feature_cols") or [])
    group_feature_cols = list(artifacts.get("group_feature_cols") or [])

    end_ts = None
    start_ts = None
    if args.window_hours and args.window_hours > 0:
        start_ts = int(time.time() * 1000) - int(args.window_hours * 60 * 60 * 1000)

    loaded = load_data(args.db, start_ts=start_ts, end_ts=end_ts)
    station_feat_df, station_feature_cols_runtime = build_station_features(
        loaded.station_df, loaded.group_df
    )
    group_feat_df, group_feature_cols_runtime = build_group_features(station_feat_df, loaded.group_df)

    # Enforce feature schema from training artifacts to avoid X feature-count mismatch.
    # If columns are missing (e.g. due to short history), add them as NaN.
    if station_feature_cols:
        station_feat_df = _ensure_columns(station_feat_df, station_feature_cols)
    else:
        station_feature_cols = station_feature_cols_runtime

    if group_feature_cols:
        group_feat_df = _ensure_columns(group_feat_df, group_feature_cols)
    else:
        group_feature_cols = group_feature_cols_runtime

    station_x_df, group_x_df, latest_ts = latest_features_for_inference(
        station_feat_df,
        group_feat_df,
        station_feature_cols,
        group_feature_cols,
    )

    out: Dict[str, Any] = {
        "ts": latest_ts,
        "horizons": list(HORIZONS_MS.keys()),
        "station": {"targetPowerKw": {"now": None, "pred": {}}},
        "bms": {},
        "macro": {
            "probAnyFault": {},
            "expectedFaultedGroups": {},
            "probAnyWarning": {},
            "expectedWarnedGroups": {},
        },
        "features": {"station": {}, "groups": {}},
        "modelInfo": {
            "trainedAtMs": int(artifacts.get("trained_at_ms") or 0),
            "dbPath": str(artifacts.get("db_path") or ""),
            "modelPath": os.path.abspath(args.model),
            "stationFeatureCols": list(artifacts.get("station_feature_cols") or []),
            "groupFeatureCols": list(artifacts.get("group_feature_cols") or []),
            "metrics": artifacts.get("metrics") or {},
        },
    }

    if not station_x_df.empty:
        station_now = float(station_feat_df[station_feat_df["ts"] == latest_ts]["stationTargetPowerKw"].tail(1).iloc[0])
        out["station"]["targetPowerKw"]["now"] = _to_py(station_now)

        x_station = station_x_df[station_feature_cols].to_numpy(dtype=float)
        for h_key in HORIZONS_MS.keys():
            model = (artifacts.get("models") or {}).get("station", {}).get(h_key)
            if model is None:
                out["station"]["targetPowerKw"]["pred"][h_key] = None
                continue
            pred = float(model.predict(x_station)[0])
            out["station"]["targetPowerKw"]["pred"][h_key] = _to_py(pred)

        out["features"]["station"] = {
            k: _to_py(float(station_x_df[k].iloc[0])) if k in station_x_df.columns else None
            for k in station_feature_cols
        }

    if not group_x_df.empty:
        x_group = group_x_df[group_feature_cols].to_numpy(dtype=float)
        gids = group_x_df["groupId"].to_numpy(dtype=int)

        fault_probs_by_h: Dict[str, np.ndarray] = {}
        warn_probs_by_h: Dict[str, np.ndarray] = {}
        for h_key in HORIZONS_MS.keys():
            clf_fault = (artifacts.get("models") or {}).get("fault", {}).get(h_key)
            if clf_fault is None:
                fault_probs_by_h[h_key] = np.full(len(gids), np.nan)
            else:
                fault_probs_by_h[h_key] = clf_fault.predict_proba(x_group)[:, 1]

            clf_warn = (artifacts.get("models") or {}).get("warning", {}).get(h_key)
            if clf_warn is None:
                warn_probs_by_h[h_key] = np.full(len(gids), np.nan)
            else:
                warn_probs_by_h[h_key] = clf_warn.predict_proba(x_group)[:, 1]

        for i, gid in enumerate(gids):
            bms_item: Dict[str, Any] = {
                "socPct": {"pred": {}},
                "temperatureC": {"pred": {}},
                "insulationResistanceKohm": {"pred": {}},
                "deltaCellVoltageMv": {"pred": {}},
                "pcsActualKw": {"pred": {}},
                "faultProbability": {"pred": {}},
                "warningProbability": {"pred": {}},
            }

            for h_key in HORIZONS_MS.keys():
                models_group = (artifacts.get("models") or {}).get("group", {}).get(h_key, {})
                for col, out_key in [
                    ("bms_socPct", "socPct"),
                    ("bms_temperatureC", "temperatureC"),
                    ("bms_insulationResistanceKohm", "insulationResistanceKohm"),
                    ("bms_deltaCellVoltageMv", "deltaCellVoltageMv"),
                    ("pcs_actualKw", "pcsActualKw"),
                ]:
                    m = models_group.get(col)
                    if m is None:
                        bms_item[out_key]["pred"][h_key] = None
                        continue
                    pred = float(m.predict(x_group[i : i + 1])[0])
                    bms_item[out_key]["pred"][h_key] = _to_py(pred)

                fp = float(fault_probs_by_h[h_key][i])
                wp = float(warn_probs_by_h[h_key][i])
                bms_item["faultProbability"]["pred"][h_key] = _to_py(fp)
                bms_item["warningProbability"]["pred"][h_key] = _to_py(wp)

            out["bms"][str(gid)] = bms_item

            out["features"]["groups"][str(gid)] = {
                k: _to_py(float(group_x_df[k].iloc[i])) if k in group_x_df.columns else None
                for k in group_feature_cols
            }

        for h_key in HORIZONS_MS.keys():
            ps = fault_probs_by_h[h_key]
            ps = ps[np.isfinite(ps)]
            if ps.size == 0:
                out["macro"]["expectedFaultedGroups"][h_key] = None
                out["macro"]["probAnyFault"][h_key] = None
            else:
                exp_cnt = float(ps.sum())
                prob_any = float(1.0 - np.prod(1.0 - np.clip(ps, 0.0, 1.0)))
                out["macro"]["expectedFaultedGroups"][h_key] = _to_py(exp_cnt)
                out["macro"]["probAnyFault"][h_key] = _to_py(prob_any)

            ws = warn_probs_by_h[h_key]
            ws = ws[np.isfinite(ws)]
            if ws.size == 0:
                out["macro"]["expectedWarnedGroups"][h_key] = None
                out["macro"]["probAnyWarning"][h_key] = None
            else:
                exp_w = float(ws.sum())
                prob_any_w = float(1.0 - np.prod(1.0 - np.clip(ws, 0.0, 1.0)))
                out["macro"]["expectedWarnedGroups"][h_key] = _to_py(exp_w)
                out["macro"]["probAnyWarning"][h_key] = _to_py(prob_any_w)

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)

    print(json.dumps({"ok": True, "path": args.out, "ts": latest_ts}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
