"""감사 comparison.json을 이용해 추천 2의 전후 지도와 제외 간선을 그린다."""
import argparse
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from matplotlib.font_manager import FontProperties
import numpy as np

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("report", type=Path)
args = parser.parse_args()
data = json.loads((args.report / "comparison.json").read_text())
font_path = Path.home() / "Library/Fonts/SCDream4.otf"
font = FontProperties(fname=str(font_path), size=10)
plt.rcParams["axes.unicode_minus"] = False
fig, axes = plt.subplots(1, 2, figsize=(14, 7), dpi=160, facecolor="#fcfcfb")
points = np.vstack([data[k][1]["xy"] for k in ("before", "after")])
center = (points.min(axis=0) + points.max(axis=0)) / 2
span = max(np.ptp(points[:, 0]), np.ptp(points[:, 1])) * .59
by_id = {e["edge_id"]: e for e in data["before_edges"]}
roads = [e["xy"] for e in data["before_edges"] if e["allowed"]]
blocked = [by_id[e["edge_id"]]["xy"] for e in data["blocked"]]
for ax, key, label in zip(axes, ("before", "after"), ("검토 전 추천 2", "검토 후 추천 2")):
    ax.set_facecolor("#fcfcfb")
    ax.add_collection(LineCollection(roads, colors="#deded8", linewidths=.6))
    route = data[key][1]
    xy = np.asarray(route["xy"])
    ax.plot(xy[:, 0], xy[:, 1], color="white", lw=5, zorder=3)
    ax.plot(xy[:, 0], xy[:, 1], color="#777777" if key == "before" else "#208044", lw=2.8, zorder=4)
    ax.add_collection(LineCollection(blocked, colors="#c64736", linewidths=3.8, linestyles="dashed", zorder=5))
    ax.scatter([xy[0, 0]], [xy[0, 1]], s=65, c="black", edgecolors="white", zorder=6)
    ax.set_xlim(center[0] - span, center[0] + span)
    ax.set_ylim(center[1] - span, center[1] + span)
    ax.set_aspect("equal")
    ax.axis("off")
    summary = route["course"]["summary"]
    ax.set_title(f"{label}\n{summary['distance_m']/1000:.2f}km · 경로 비용 {route['cost']:,.0f}", fontproperties=font, fontsize=15, pad=14)
    ax.plot([], [], color="#c64736", lw=3, ls="--", label="팀 제보 6~9번 · 제외 간선 4개")
    ax.plot([], [], color="#777777" if key == "before" else "#208044", lw=3, label=label)
    ax.legend(loc="lower left", prop=font, frameon=False)
fig.suptitle("같은 출발지 · Loop 5km · α=3 · 보행 제외 629.4m 반영", fontproperties=font, fontsize=18, y=.99)
fig.text(.04, .035, "제외 범위: 2334-0 · 1366-0 · 1365-0 · 1109-0 / 팀 검토를 반영한 제외이며 대체 코스의 현장 통행을 보증하지 않음", fontproperties=font, fontsize=9, color="#555555")
fig.subplots_adjust(top=.84, bottom=.12, left=.02, right=.98, wspace=.08)
fig.savefig(args.report / "route2-before-after.png", facecolor="#fcfcfb")
print("route2-before-after.png 생성")
