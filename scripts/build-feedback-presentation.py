"""기존 초록 테마를 보존하며 피드백 반영본(슬라이드·PNG·PPTX·실험 자료)을 별도 생성.

python scripts/build-feedback-presentation.py --output artifacts/DALRO-feedback-2026-11-17
matplotlib, python-pptx, Pillow가 필요하다. 원본 자료와 pdf/는 수정하지 않는다.
"""
import argparse
import hashlib
import html
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image
from pptx import Presentation
from pptx.util import Inches


SIMPLE = '''def fig02():
    fig = figure("PACE 비용: 달리기 부담을 패널티로 반영", "환경 패널티는 0~1 · 낮을수록 좋음 · 점수로 반전하지 않음")
    cards = [
        ("01", "멈춤·경사 정보", "신호 부착대·횡단보도 밀도와\\n지형 경사를 같은 범위로 정리"),
        ("02", "환경 패널티 p", "가중치: 멈춤 요인 83% · 경사 17%\\n불리한 조건일수록 p가 커짐"),
        ("03", "거리와 함께 경로 탐색", "C(e) = 길이 × (1 + α × p)\\n전체 경로 비용의 합이 작은 길 탐색"),
    ]
    for i, (num, title, body) in enumerate(cards):
        x = 0.045 + i * 0.31
        fig.add_artist(FancyBboxPatch((x, 0.36), 0.285, 0.39, boxstyle="round,pad=0,rounding_size=0.012", fc="white", ec=GREEN, transform=fig.transFigure))
        fig.text(x + 0.022, 0.66, num, fontproperties=font(19, 7), color=GREEN)
        fig.text(x + 0.022, 0.57, title, fontproperties=font(12, 7), color=INK)
        fig.text(x + 0.022, 0.43, body, fontproperties=font(8.6, 4), color=INK2, linespacing=1.8)
    fig.text(0.06, 0.23, "예: 100m 도로 · 패널티 0.2 · α=3 → 거리 환산 비용 160m", fontproperties=font(14, 7), color=GREEN)
    note(fig, "가중치는 기존 팀 설정 유지 · 세부 정규화 5단계와 AHP 표는 부록으로 분리 · 실제 주행 거리나 측정된 체감 거리가 아님")
    fig.savefig(HERE / "simple-flow.png", transparent=True)
    save(fig, "02_PACE_Cost_산정")


'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--previous", type=Path, default=Path("artifacts/DALRO-발표-초록테마/source"))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root, previous = args.output.resolve(), args.previous.resolve()
    source = root / "source"
    source.mkdir(parents=True, exist_ok=True)
    base = source / "base"
    base.mkdir(exist_ok=True)
    for name in ("plots.py", "elements.py", "data.json"):
        if (previous / name).resolve() != (base / name).resolve():
            shutil.copy2(previous / name, base / name)
    experiment = json.loads((root / "experiments.json").read_text())
    data = json.loads((previous / "data.json").read_text())
    assert data["version"] == experiment["network_version"]
    for old, new in zip(data["loop"]["chosen"], experiment["loop"]):
        assert abs(old["length"] - new["course"]["summary"]["distance_m"]) < 1
    data["loop"]["courses"] = [c["course"] for c in experiment["loop"]]
    data["alpha"] = [{**r, "length": r["distance_m"], "stops": r["stop_factors"]} for r in experiment["pairs"][0]["runs"]]

    def canonical(value):
        if isinstance(value, list):
            return [canonical(v) for v in value]
        if isinstance(value, dict):
            return {("selection_cost" if k == "score" else k): canonical(v)
                    for k, v in value.items() if k != "environment_score"}
        return value
    data = canonical(data)
    (source / "data.json").write_text(json.dumps(data, ensure_ascii=False))
    plots = (previous / "plots.py").read_text()
    elements = (previous / "elements.py").read_text()
    replacements = {
        "환경 악화 점수": "환경 패널티", "최종 점수": "선정 비용",
        "점수 = Cost/거리": "선정 비용 = Cost/거리", 'd["score"]': 'd["selection_cost"]',
        'c["score"]': 'c["selection_cost"]', "체감 거리": "거리 환산 비용",
        "낮을수록 멈춤·경사 적음": "낮을수록 평균 패널티 작음",
        'SEQ = ["#B0D991", "#67AE55", "#287D42", "#124B35"]': 'SEQ = ["#FCE8C8", "#F4BE76", "#D98136", "#91451D"]',
    }
    for old, new in replacements.items():
        plots, elements = plots.replace(old, new), elements.replace(old, new)
    # 기존 계산 설명은 부록으로 옮긴다. 메인에는 3단계와 비용식 하나만 남긴다.
    start, end = plots.index("def fig02():"), plots.index("# ================= 03")
    appendix = plots[start:end].replace("def fig02():", "def fig15():").replace("02_PACE_Cost_산정", "15_부록_정규화_AHP")
    appendix = appendix.replace("PACE Cost 산정: AHP 가중치", "부록 · 세부 정규화와 AHP 가중치")
    plots = plots[:start] + SIMPLE + plots[end:]
    plots = plots.replace("if __name__ == \"__main__\":", appendix + "\nif __name__ == \"__main__\":")
    plots = plots.replace("fig09, fig10):", "fig09, fig10, fig15):")
    # 패널티(주황 순차색)와 추천 경로(초록)를 서로 다른 시각 변수로 구분한다.
    marker = '    b = np.array(D["boundary"])'
    plots = plots.replace(marker, '    route(ax, D["alpha"][2]["xy"], GREEN, lw=2.5, z=8)\n' + marker, 1)
    plots = plots.replace('    stats = [', '''    fig.text(lx, 0.405, "주황이 진할수록 패널티 큼", fontproperties=font(9, 7), color=INK)
    fig.text(lx, 0.36, "초록 실선 = PACE 추천 경로", fontproperties=font(9, 7), color=GREEN)
    stats = [''', 1)
    plots = plots.replace("배포 서버(darlo-app.vercel.app) 응답과 동일", "동일 실데이터·현재 서버 코드로 로컬 재계산")
    plots = plots.replace("Expo 웹 빌드 · 같은 Vercel 배포의 FastAPI /api 호출 · 휴대폰 브라우저 화면", "로컬 Expo 웹 + 임시 SQLite FastAPI · 실제 HTTP 추천 · 휴대폰 크기 Chrome 화면")
    plots = plots.replace("2026-10-30 darlo-app.vercel.app 캡처 · POST /api/v1/courses/recommendations → 실데이터 추천 3개(is_mock = false)", "2026-11-17 로컬 캡처 · 실데이터 추천(is_mock=false) · 모의 러닝(GPS 아님) · 배포 전")
    # 부록의 5단계 원본을 투명 요소로 유지하되 제목을 명시한다.
    elements = elements.replace('"02a_PACE_Cost_계산단계"', '"02a_부록_세부계산단계"')
    elements = elements.replace('    b = np.array(D["boundary"])', '    route(ax, D["alpha"][2]["xy"], GREEN, lw=2.5, z=8)\n    b = np.array(D["boundary"])', 1)
    legend_start, legend_end = elements.index("    fig = new(4.2, 2.1)"), elements.index("# ---------------- 04")
    legend = elements[legend_start:legend_end]
    legend = legend.replace("new(4.2, 2.1)", "new(4.7, 2.7)").replace('"PACE penalty"', '"환경 패널티 · 낮을수록 좋음"')
    legend = legend.replace("y = 0.7 - i * 0.16", "y = 0.73 - i * 0.14")
    legend = legend.replace("[0.06, 0.06]", "[0.12, 0.12]").replace("0.14, 0.06", "0.14, 0.12")
    legend = legend.replace('    save(fig, "03b_penalty_범례")', '''    ax.plot([0, 0.1], [0.01, 0.01], color=GREEN, lw=2.5)
    ax.text(0.14, 0.01, "초록 실선 = PACE 추천 경로", va="center", fontproperties=font(8, 6), color=GREEN)
    save(fig, "03b_penalty_범례")''')
    elements = elements[:legend_start] + legend + elements[legend_end:]
    # 옛 앱 화면 재사용 코드를 제거하고 현재 캡처를 사용한다.
    tail = elements.index("# 기존 라임 테마 앱 캡처")
    elements = elements[:tail] + "e10()\n"
    (source / "plots.py").write_text(plots)
    (source / "elements.py").write_text(elements)
    for name in ("01-home", "02-condition", "03-recommend-1", "06-ready", "07-running"):
        if not (source / "shots" / f"{name}.png").is_file():
            raise ValueError("현재 앱 캡처가 필요합니다: scripts/capture-feedback.mjs")
    subprocess.run([sys.executable, str(source / "plots.py")], check=True)
    subprocess.run([sys.executable, str(source / "elements.py")], check=True)
    spec = importlib.util.spec_from_file_location("feedback_plots", source / "plots.py")
    p = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(p)
    # 간단한 패널티 흐름도도 투명 PNG로 제공한다.
    p.fig02()
    with Image.open(source / "simple-flow.png") as im:
        im.crop((85, 250, 1830, 730)).save(source / "elements/02d_패널티_간단흐름.png")

    def table(fig, rows, rect, sizes=None):
        ax = fig.add_axes(rect)
        ax.axis("off")
        ncols = len(rows[0])
        widths = sizes or [1 / ncols] * ncols
        xs = np.r_[0, np.cumsum(widths)]
        rh = 1 / len(rows)
        for i, row in enumerate(rows):
            y = 1 - (i + 0.5) * rh
            for j, cell in enumerate(row):
                ax.text(xs[j] + 0.006, y, str(cell), fontproperties=p.font(8.2, 7 if i == 0 else 5),
                        color=p.GREEN if i == 0 else p.INK, va="center", transform=ax.transAxes)
            ax.plot([0, 1], [1 - (i + 1) * rh] * 2, color=p.GRID, lw=0.7, transform=ax.transAxes)

    fig = p.figure("추가 3개 경로 검증: 효과와 예외를 함께 확인", "같은 도로망·같은 통행 조건 · α=0 최단거리와 α=3 PACE 비교")
    rows = [["출발 → 도착", "거리 변화", "멈춤 요인", "해석"]]
    for pair in experiment["pairs"][1:]:
        a, b = pair["runs"][0], pair["runs"][2]
        label = pair["label"].split(" · ")[1].replace("이촌 한강공원", "이촌").replace("용산가족공원", "가족공원").replace("남산 둘레길", "남산")
        rows.append([label, f"+{b['distance_change_pct']:.1f}%", f"{a['stop_factors']} → {b['stop_factors']}",
                     f"{abs(b['stop_reduction_pct']):.1f}% " + ("감소" if b["stop_reduction_pct"] >= 0 else "증가")])
    table(fig, rows, [0.045, 0.40, 0.91, 0.36], [0.44, 0.16, 0.20, 0.20])
    fig.text(0.06, 0.26, "추가 3쌍 중 2쌍 감소 · 삼각지 → 이촌은 시설 합계 증가", fontproperties=p.font(14, 7), color=p.GREEN)
    fig.text(0.06, 0.16, "최적화 대상은 거리와 환경 패널티를 반영한 경로 비용입니다.\n경로 주변 시설 수와 실제 정지·대기 시간은 서로 다릅니다.", fontproperties=p.font(10, 4), color=p.INK2, linespacing=1.7)
    p.note(fig, "결과 선별 없이 3쌍 모두 제시 · 시설 수: 경로 10m 버퍼 안 고유 신호 부착대+횡단보도 · 현장 주행 검증 아님")
    p.save(fig, "11_추가실험_결과요약")
    for i, pair in enumerate(experiment["pairs"][1:], 12):
        fig = p.figure(pair["label"], "α=0·1·3·5 전체 결과 · 초록 실선 PACE(α=3), 회색 점선 최단거리(α=0)")
        ax = fig.add_axes([0.035, 0.14, 0.46, 0.65])
        p.roads(ax, lw=0.35)
        base, pace3 = pair["runs"][0], pair["runs"][2]
        pts = np.vstack([base["xy"], pace3["xy"]])
        a = np.array(base["xy"])
        ax.plot(a[:, 0], a[:, 1], color="#777777", lw=2.5, ls="--", zorder=6)
        p.route(ax, pace3["xy"], p.GREEN, lw=2.3, z=7)
        p.start_marker(ax, a[0], "출발")
        p.start_marker(ax, a[-1], "도착")
        aspect = .46 * 9.6 / (.65 * 5.4)
        center = (pts.min(axis=0) + pts.max(axis=0)) / 2
        half = max(np.ptp(pts[:, 0]) / 2, np.ptp(pts[:, 1]) / 2 * aspect) * 1.15
        p.map_axes(ax, center, half, aspect)
        p.scalebar(ax, center[0] - half * .85, center[1] - half / aspect * .85, 500)
        rows = [["α", "km", "신호", "횡단", "합계", "패널티"]]
        for r in pair["runs"]:
            rows.append([r["alpha"], f"{r['distance_m']/1000:.3f}", r["signal_count"], r["crossing_count"], r["stop_factors"], f"{r['environment_penalty']:.4f}"])
        table(fig, rows, [0.54, 0.44, 0.42, 0.33], [.09, .21, .15, .15, .15, .25])
        reduction = pace3["stop_reduction_pct"]
        title = f"α=3 · 거리 +{pace3['distance_change_pct']:.1f}%\n멈춤 요인 {abs(reduction):.1f}% " + ("감소" if reduction >= 0 else "증가")
        fig.text(.55, .29, title, fontproperties=p.font(13, 7), color=p.GREEN, linespacing=1.7)
        fig.text(.55, .15, "환경 패널티: 낮을수록 좋음\n신호 부착대 ≠ 실제 정지 횟수", fontproperties=p.font(9, 4), color=p.INK2, linespacing=1.7)
        p.note(fig, "측정 조건·좌표·스냅 거리·원시 수치: experiments.csv / routes.geojson / experiment-report.md")
        p.save(fig, f"{i:02}_추가실험_{i-11}")
    # 전달 폴더. PNG 원본과 PPTX 모두 같은 렌더를 사용한다.
    for origin, target in [("out", "SLIDES"), ("elements", "PNG")]:
        (root / target).mkdir(exist_ok=True)
        for path in sorted((source / origin).glob("*.png")):
            shutil.copy2(path, root / target / path.name)
    slides = sorted((root / "SLIDES").glob("*.png"))
    elements = sorted((root / "PNG").glob("*.png"))
    assert len(slides) == 15
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(13.333333), Inches(7.5)
    for path in slides:
        slide = prs.slides.add_slide(prs.slide_layouts[6])
        slide.shapes.add_picture(str(path), 0, 0, width=prs.slide_width, height=prs.slide_height)
        slide.notes_slide.notes_text_frame.text = path.stem + "\n2026-11-17 피드백 반영. 패널티·경로 비용·선정 비용 모두 낮을수록 좋음. 본문은 간단히 설명하고 상세 공식·AHP는 부록으로 분리. 실험은 시설 자료 기반이며 실제 정지 횟수·안전 보장이 아님."
    prs.core_properties.title = "DALRO PACE — 피드백 반영 및 추가 경로 검증"
    deck = root / "DALRO_feedback_2026-11-17.pptx"
    prs.save(deck)
    assert len(Presentation(deck).slides) == 15
    manifest = []
    for path in slides + elements:
        with Image.open(path) as im:
            if path.parent.name == "SLIDES":
                assert im.size == (1920, 1080)
            manifest.append({"file": str(path.relative_to(root)), "size": im.size, "mode": im.mode,
                             "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    (root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    cards = ["<!doctype html><html lang='ko'><meta charset='utf-8'><title>DALRO 피드백 반영본</title><style>body{font:16px system-ui;background:#f4f7f0;margin:30px;color:#173b29}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:24px}img{width:100%;height:300px;object-fit:contain}a{color:inherit;background:white;padding:12px;text-decoration:none}p{overflow-wrap:anywhere}</style><h1>DALRO · 피드백 반영본</h1><p>15장 · 패널티 방향 통일 · 추가 3쌍 실험 · 로컬 앱 캡처</p>"]
    for label, paths in [("슬라이드", slides), ("개별 요소", elements)]:
        cards += ["<h2>" + label + "</h2><div class='grid'>"]
        for path in paths:
            rel = html.escape(str(path.relative_to(root)))
            cards.append(f"<a href='{rel}' download><img src='{rel}'><p>{html.escape(path.name)}</p></a>")
        cards.append("</div>")
    cards.append("</html>")
    (root / "preview.html").write_text("".join(cards))
    (root / "README.md").write_text("# DALRO 교수님 피드백 반영본\n\nSLIDES: 15장(기존 10장 수정 + 추가 실험 요약 1장·경로별 3장 + 상세 공식 부록 1장).\nPNG: 개별 요소. PPTX: 이미지 슬라이드로 텍스트는 개별 편집 불가. source/: 재생성 코드·계산 자료·현재 앱 캡처.\n\n주황이 진할수록 도로 패널티가 크고, 초록 실선은 추천 경로다. 환경 패널티·경로 비용·선정 비용은 낮을수록 좋다. AHP 가중치와 α=3은 기존 팀 설정을 유지했다.\n\n앱 캡처는 로컬 웹·고정 seed의 임시 FastAPI 서버를 실제 HTTP로 호출한 결과다. 기존 배포 사이트는 갱신하지 않았다. 모의 러닝이며 실제 기기·GPS 검증은 하지 않았다. Dijkstra/A* 확정 노드와 후보 6개 비교는 동일 도로망·변경 없는 비용식의 기존 계산 자료를 재사용했다.\n\nexperiments.csv / routes.geojson / experiment-report.md: 이번에 실행한 4쌍×4개 α 결과. 추가 3쌍 중 2쌍은 감소하고 삼각지→이촌은 멈춤 요인이 46→47개로 늘었다.\n")
    paths = slides + elements + [deck, root / "README.md", root / "preview.html", root / "manifest.json",
                                 root / "experiments.csv", root / "experiments.json", root / "routes.geojson", root / "experiment-report.md"]
    # 재현용 소스도 전달한다. 데이터는 공간 파생 자료이며 원본 DB·비밀값은 포함하지 않는다.
    paths += sorted(path for path in source.rglob("*") if path.is_file() and "__pycache__" not in path.parts
                    and path.parent.name not in ("out", "elements"))
    if Path(__file__).resolve() != (source / "build-feedback-presentation.py").resolve():
        shutil.copy2(Path(__file__), source / "build-feedback-presentation.py")
    paths.append(source / "build-feedback-presentation.py")
    for name, files in [("DALRO_feedback_all.zip", paths), ("DALRO_feedback_PNG.zip", elements)]:
        with zipfile.ZipFile(root / name, "w", zipfile.ZIP_DEFLATED) as z:
            for path in dict.fromkeys(files):
                z.write(path, str(path.relative_to(root)))
        with zipfile.ZipFile(root / name) as z:
            assert z.testzip() is None
    print(f"전달 완료: 슬라이드 {len(slides)}장 · 개별 PNG {len(elements)}개 · PPTX · ZIP 2개")


if __name__ == "__main__":
    main()
