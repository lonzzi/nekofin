"""Translate release subjects locally on the CI runner, without an inference API key.

Models: Helsinki-NLP/opus-mt-en-zh (Apache-2.0) and opus-mt-zh-en
(CC-BY-4.0), https://huggingface.co/Helsinki-NLP. Revisions are pinned.
"""
import json
import re
import sys

import torch
from transformers import MarianMTModel, MarianTokenizer

MODELS = {
    "zh": ("Helsinki-NLP/opus-mt-en-zh", "408d9bc410a388e1d9aef112a2daba955b945255"),
    "en": ("Helsinki-NLP/opus-mt-zh-en", "cf109095479db38d6df799875e34039d4938aaa6"),
}


def translate(changes):
    torch.set_num_threads(2)
    for language, (name, revision) in MODELS.items():
        pending = [change for change in changes if not change.get(language)]
        if not pending:
            continue
        tokenizer = MarianTokenizer.from_pretrained(name, revision=revision)
        model = MarianMTModel.from_pretrained(name, revision=revision).eval()
        for start in range(0, len(pending), 8):
            batch = pending[start:start + 8]
            texts = [(">>cmn_Hans<< " if language == "zh" else "") + change["title"] for change in batch]
            encoded = tokenizer(texts, return_tensors="pt", padding=True, truncation=True, max_length=256)
            with torch.inference_mode():
                generated = model.generate(**encoded, num_beams=4, max_new_tokens=256)
            for change, text in zip(batch, tokenizer.batch_decode(generated, skip_special_tokens=True)):
                if language == "zh":
                    # Technical terms are ambiguous without the app's domain context.
                    if re.search(r"\bplayer\b", change["title"], re.I):
                        text = text.replace("玩家", "播放器")
                    if re.search(r"\bpickers?\b", change["title"], re.I):
                        text = text.replace("提取器", "选择器").replace("采集器", "选择器")
                    if re.search(r"\bplayback\b", change["title"], re.I):
                        text = text.replace("重播", "播放").replace("回放", "播放")
                    if re.search(r"\bsegment skipping\b", change["title"], re.I):
                        text = text.replace("节跳过", "分段跳过").replace("跳过段", "跳过分段")
                    if re.search(r"\bright-aligned\b", change["title"], re.I):
                        text = text.replace("对齐的", "右侧对齐的")
                    if re.search(r"\bgesture controls\b", change["title"], re.I):
                        text = text.replace("手势控件", "手势控制")
                change[language] = text.strip()
        del model
    return [{"sha": change["sha"], "zh": change["zh"], "en": change["en"]} for change in changes]


if __name__ == "__main__":
    print(json.dumps(translate(json.load(sys.stdin)), ensure_ascii=False))
