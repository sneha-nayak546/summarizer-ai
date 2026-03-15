from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

# distilbart-cnn-6-6 = much smaller than bart-large-cnn
# Size: ~300 MB vs 1.6 GB — 5x faster download, same good quality
model_name = "sshleifer/distilbart-cnn-6-6"
save_path  = "/app/model"

print(f"Downloading {model_name} ...")
AutoTokenizer.from_pretrained(model_name).save_pretrained(save_path)
AutoModelForSeq2SeqLM.from_pretrained(model_name).save_pretrained(save_path)
print("Model saved ✓")
