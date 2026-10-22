"""Builds a Kaggle kernel folder. Usage: python3 stage.py OUT_DIR eval|train [KEY=VALUE ...]
KEY=VALUE lines become variables at the top of the script (MODEL, TAG, EPOCHS) and metrics.py is inlined."""
import json, os, sys

here = os.path.dirname(os.path.abspath(__file__))
out, mode, kv = sys.argv[1], sys.argv[2], dict(a.split("=", 1) for a in sys.argv[3:])
slug = {"train": "goserve-laya-train", "eval": "goserve-laya-eval-" + kv.get("TAG", "base")}[mode]
body = open(f"{here}/{mode}.py").read()
if mode == "eval":
    src = open(f"{here}/../metrics.py").read()
    body = body.replace("import metrics", f"import types\nmetrics = types.ModuleType('metrics')\nexec({src!r}, metrics.__dict__)")
header = "".join(f"import os; os.environ[{k!r}] = {v!r}\n" for k, v in kv.items())
os.makedirs(out, exist_ok=True)
open(f"{out}/script.py", "w").write(header + body)
meta = {"id": "klickbae8yt/" + slug, "title": slug.replace("-", " "), "code_file": "script.py", "language": "python",
        "kernel_type": "script", "is_private": True, "enable_gpu": mode == "train", "enable_internet": True,
        "dataset_sources": [kv.get("DATA", "klickbae8yt/goserve-laya-synth-v1")], "kernel_sources": kv.get("SOURCE", "").split(",") if kv.get("SOURCE") else []}
if mode == "train":
    meta["machine_shape"] = "NvidiaTeslaT4"
json.dump(meta, open(f"{out}/kernel-metadata.json", "w"), indent=1)
print("staged", out, slug)
