// Animation for an auto-scrolling parallax element class
// using background-offset-y (does not scroll horizontally).
const log = console.log.bind(console)
console.clear()

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize)
} else {
  initialize()
}

function initialize () {
  log('Initializer called. 🌞')
  fixParallaxSizes()
  window.addEventListener('resize', event => {
    fixParallaxSizes()
  })

  requestAnimationFrame(animateParallax)
}

function fixParallaxSizes () {
  for (const e of document.querySelectorAll('.parallax')) {
    e.style.setProperty('--client-height',
      e.getBoundingClientRect().height + 'px')
  }
}

function animateParallax (timestamp) {
  const scrollY = window.scrollY
  const normalizedTop =
    (window.scrollY)
    / document.documentElement.scrollHeight
  const normalizedBottom =
    (window.scrollY + window.innerHeight)
    / document.documentElement.scrollHeight

  let statusString
  statusString +=
    `scrollY: ${scrollY}<br> nTop: ${normalizedTop.toFixed(2)}`
    +` nBot: ${normalizedBottom.toFixed(2)}`

  for (const e of document.querySelectorAll('.parallax')) {
    // Compute progress scalar (0 ... 1.0) for element scroll
    // 0.0 -> top of element just reached bottom of viewport
    // 1.0 -> bottom of element just reached top of viewport
    const rect = e.getBoundingClientRect()
    const s = rect.bottom / (window.innerHeight + rect.height)
    const overfit = getComputedStyle(e).getPropertyValue('--overfit')
    statusString += '<br>Overfit:' + getComputedStyle(e).getPropertyValue('--overfit')

    e.style['background-position-y'] = (-(1-s) * overfit * rect.height) + 'px'
  }

  // document.querySelector('.status').innerHTML = statusString

  requestAnimationFrame(animateParallax)
}

