import argparse
import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple


def _fmt_dt(ts_ms: int) -> str:
    try:
        return datetime.fromtimestamp(ts_ms / 1000).strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return str(ts_ms)


def _fmt_num(v: Any, digits: int = 2) -> str:
    if v is None:
        return "暂无"
    try:
        x = float(v)
    except Exception:
        return "暂无"
    if x != x:
        return "暂无"
    if abs(x) >= 100:
        return f"{x:.1f}"
    return f"{x:.{digits}f}"


def _fmt_pct(v: Any, digits: int = 1) -> str:
    if v is None:
        return "暂无"
    try:
        x = float(v)
    except Exception:
        return "暂无"
    if x != x:
        return "暂无"
    return f"{x * 100:.{digits}f}%"


def _pick_fault_score(bms_item: Dict[str, Any]) -> Tuple[Optional[float], str]:
    fp = ((bms_item.get("faultProbability") or {}).get("pred") or {})
    for key in ["5m", "60s", "1h"]:
        v = fp.get(key)
        if v is None:
            continue
        try:
            x = float(v)
            if x == x:
                return x, key
        except Exception:
            pass
    return None, ""


def _pick_warn_score(bms_item: Dict[str, Any]) -> Tuple[Optional[float], str]:
    wp = ((bms_item.get("warningProbability") or {}).get("pred") or {})
    for key in ["5m", "60s", "1h"]:
        v = wp.get(key)
        if v is None:
            continue
        try:
            x = float(v)
            if x == x:
                return x, key
        except Exception:
            pass
    return None, ""


def _health_flags(insu: Any, delta: Any, temp: Any) -> List[str]:
    flags: List[str] = []
    try:
        if insu is not None and float(insu) == float(insu) and float(insu) < 200:
            flags.append("绝缘偏低")
    except Exception:
        pass
    try:
        if delta is not None and float(delta) == float(delta) and float(delta) >= 60:
            flags.append("压差偏大")
    except Exception:
        pass
    try:
        if temp is not None and float(temp) == float(temp) and float(temp) >= 55:
            flags.append("温度偏高")
    except Exception:
        pass
    return flags


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", default=os.path.join("server", "data", "predictions-latest.json"))
    ap.add_argument("--out", default=os.path.join("train", "prediction.txt"))
    args = ap.parse_args()

    with open(args.json, "r", encoding="utf-8") as f:
        data = json.load(f)

    ts = int(data.get("ts") or 0)
    horizons = list(data.get("horizons") or [])

    station = data.get("station") or {}
    station_target = (station.get("targetPowerKw") or {})
    now_kw = station_target.get("now")
    pred_kw = (station_target.get("pred") or {})

    macro = data.get("macro") or {}
    prob_any = macro.get("probAnyFault") or {}
    exp_fault = macro.get("expectedFaultedGroups") or {}
    prob_any_warn = macro.get("probAnyWarning") or {}
    exp_warn = macro.get("expectedWarnedGroups") or {}

    bms = data.get("bms") or {}

    lines: List[str] = []
    lines.append("预测摘要（prediction.txt）")
    lines.append("=" * 60)
    lines.append(f"时间戳: {ts}")
    lines.append(f"时间: {_fmt_dt(ts)}")
    lines.append(f"预测窗口: {', '.join(horizons) if horizons else '未知'}")
    lines.append("")

    lines.append("[1] 全站 EMS 目标功率趋势（kW）")
    lines.append("-" * 60)
    lines.append(f"当前目标功率: {_fmt_num(now_kw)} kW")
    for h in ["60s", "5m", "1h"]:
        if h not in horizons:
            continue
        p = pred_kw.get(h)
        if p is None or (isinstance(p, float) and p != p):
            lines.append(f"{h}: 暂无")
            continue
        delta = None
        try:
            if now_kw is not None:
                delta = float(p) - float(now_kw)
        except Exception:
            delta = None
        if delta is None:
            lines.append(f"{h}: 预测={_fmt_num(p)} kW")
        else:
            lines.append(f"{h}: 预测={_fmt_num(p)} kW（变化 {_fmt_num(delta)} kW）")
    lines.append("")

    lines.append("[2] 宏观风险（概率预测）")
    lines.append("-" * 60)
    for h in ["60s", "5m", "1h"]:
        if h not in horizons:
            continue
        pa = prob_any.get(h)
        ef = exp_fault.get(h)
        pw = prob_any_warn.get(h)
        ew = exp_warn.get(h)
        lines.append(f"{h}: 故障风险-至少一组={_fmt_pct(pa)}，预计故障组数={_fmt_num(ef)}")
        lines.append(f"{h}: 告警风险-至少一组={_fmt_pct(pw)}，预计告警组数={_fmt_num(ew)}")
    lines.append("")

    lines.append("[3] 电池组（BMS）重点趋势与风险排行")
    lines.append("-" * 60)

    rank_fault: List[Tuple[str, Optional[float], str]] = []
    rank_warn: List[Tuple[str, Optional[float], str]] = []
    for gid, item in bms.items():
        it = item if isinstance(item, dict) else {}
        score_f, key_f = _pick_fault_score(it)
        score_w, key_w = _pick_warn_score(it)
        rank_fault.append((str(gid), score_f, key_f))
        rank_warn.append((str(gid), score_w, key_w))

    def _sort_key(x: Tuple[str, Optional[float], str]):
        gid, score, _key = x
        return (-1.0 if score is None else -float(score), int(gid) if gid.isdigit() else 10**9)

    rank_fault.sort(key=_sort_key)
    rank_warn.sort(key=_sort_key)

    top_n = min(10, len(rank_fault))
    if top_n == 0:
        lines.append("暂无 BMS 预测数据")
    else:
        lines.append("故障风险Top（按故障概率，优先5m，其次60s/1h）：")
        for i in range(top_n):
            gid, score, key = rank_fault[i]
            if score is None:
                lines.append(f"{i+1:02d}) 电池组 {gid}: 故障概率=暂无")
            else:
                lines.append(f"{i+1:02d}) 电池组 {gid}: 故障概率(+{key})={_fmt_pct(score)}")

        lines.append("")
        lines.append("告警风险Top（按告警概率，优先5m，其次60s/1h）：")
        for i in range(min(10, len(rank_warn))):
            gid, score, key = rank_warn[i]
            if score is None:
                lines.append(f"{i+1:02d}) 电池组 {gid}: 告警概率=暂无")
            else:
                lines.append(f"{i+1:02d}) 电池组 {gid}: 告警概率(+{key})={_fmt_pct(score)}")

        lines.append("")
        lines.append("各组关键指标（优先展示 60s 与 5m）：")
        for gid, _score, _key in rank_fault[:top_n]:
            item = bms.get(gid)
            if not isinstance(item, dict):
                continue
            soc = ((item.get("socPct") or {}).get("pred") or {})
            temp = ((item.get("temperatureC") or {}).get("pred") or {})
            insu = ((item.get("insulationResistanceKohm") or {}).get("pred") or {})
            delt = ((item.get("deltaCellVoltageMv") or {}).get("pred") or {})
            pcs = ((item.get("pcsActualKw") or {}).get("pred") or {})
            fp = ((item.get("faultProbability") or {}).get("pred") or {})
            wp = ((item.get("warningProbability") or {}).get("pred") or {})

            insu60 = insu.get("60s")
            delt60 = delt.get("60s")
            temp60 = temp.get("60s")
            flags = _health_flags(insu60, delt60, temp60)
            flag_text = f"（提示：{', '.join(flags)}）" if flags else ""

            lines.append(f"- 电池组 {gid}{flag_text}")
            lines.append(
                f"  60s: SOC={_fmt_num(soc.get('60s'))}%，温度={_fmt_num(temp.get('60s'))}℃，绝缘={_fmt_num(insu.get('60s'))}kΩ，压差={_fmt_num(delt.get('60s'))}mV，PCS功率={_fmt_num(pcs.get('60s'))}kW，告警概率={_fmt_pct(wp.get('60s'))}，故障概率={_fmt_pct(fp.get('60s'))}"
            )
            lines.append(
                f"  5m : SOC={_fmt_num(soc.get('5m'))}%，温度={_fmt_num(temp.get('5m'))}℃，绝缘={_fmt_num(insu.get('5m'))}kΩ，压差={_fmt_num(delt.get('5m'))}mV，PCS功率={_fmt_num(pcs.get('5m'))}kW，告警概率={_fmt_pct(wp.get('5m'))}，故障概率={_fmt_pct(fp.get('5m'))}"
            )

    lines.append("")
    lines.append("[4] 说明")
    lines.append("-" * 60)
    lines.append("- 本文件为将 JSON 预测结果转为可读摘要。")
    lines.append("- 若某些窗口显示“暂无”，通常表示该窗口模型未训练成功或数据样本不足。")
    lines.append("- 告警概率标签：未来窗口内出现 warning 级别告警事件。")
    lines.append("- 故障概率标签：未来窗口内出现 critical 或 锁存(type=锁存) 事件。")

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
