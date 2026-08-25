import requests
import json

# Test the /predict endpoint
url = "http://localhost:8000/predict"

# Use one of the test images
image_path = "C:/Codigos/SliptConter/ia-worker/training/img caixas empilhadas/IMG_3080.JPG"

with open(image_path, "rb") as f:
    files = {"imagem": ("foto.jpg", f, "image/jpeg")}
    response = requests.post(url, files=files)

print(f"Status: {response.status_code}")
print(f"Response:")
print(json.dumps(response.json(), indent=2, ensure_ascii=False))
