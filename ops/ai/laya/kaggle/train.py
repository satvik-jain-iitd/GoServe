"""Kaggle script: fine-tune Laya on our train.jsonl. Output: /kaggle/working/laya_goserve_v1 (loads with laya.load)."""
import glob, os, subprocess, sys

subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "laya"])
from laya.train import TrainConfig, finetune

data = os.path.dirname(glob.glob("/kaggle/input/**/train.jsonl", recursive=True)[0])
cfg = TrainConfig(epochs=int(os.environ.get("EPOCHS", 4)), max_len=512, head_max_len=192)
summary = finetune(f"{data}/train.jsonl", os.environ.get("BASE", "convaiinnovations/laya"), "/kaggle/working/laya_goserve_v1", cfg)
print("SUMMARY", summary)
