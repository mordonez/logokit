import requests

response = requests.post(
    'http://localhost:8080/api/generate',
    json={
        'text': 'Acme Labs',
        'secondaryText': 'Research Studio',
        'layout': 'horizontal',
        'format': 'svg',
    },
    timeout=30,
)
response.raise_for_status()
print(response.text[:120])
