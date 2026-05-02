const response = await fetch('http://localhost:8080/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Acme Labs',
    secondaryText: 'Research Studio',
    layout: 'horizontal',
    format: 'svg',
  }),
})

const svg = await response.text()
console.log(svg.slice(0, 120))
