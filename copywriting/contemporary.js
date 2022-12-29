const staticParallaxList = []
const observer = new IntersectionObserver(
  handleIntersections,
  { threshold: [0.7] })
const log = console.log.bind(console)
console.clear()

if (document.readyState === 'loading') {
  document.addEventListener('load', initialize)
} else {
  initialize()
}

function initialize () {
  const slideParallaxList =
    document.querySelectorAll('.slide-parallax')
  const observerTargets =
    document.querySelectorAll('.shade-in-shadow')

  for (const e of slideParallaxList) {
    const parsedEntry = {
      element: e,
      shift: parseFloat(
              getComputedStyle(e).getPropertyValue('--parallax-scroll')
              .trim()
              .match(/\d*/)[0]),
      units: getComputedStyle(e).getPropertyValue('--parallax-scroll')
              .trim()
              .match(/[\D]+/)[0]
    }
    staticParallaxList.push(parsedEntry)
  }

  for (const e of observerTargets) {
    observer.observe(e)
  }

  requestAnimationFrame(animateParallax)
}

function handleIntersections (entries, observer) {
  for (const e of entries) {
    if (e.isIntersecting) {
        e.target.classList.add('shadow-reveal')
    } else {
      e.target.classList.remove('shadow-reveal')
    }
  }
}

function animateParallax (timestamp) {
  // animateParallax.lastScrollY ??= scrollY

  // The commented optimization works, but negatively impacts
  // the smoothness of the animation deceleration.
  // if (animateParallax.lastScrollY !== scrollY) {
    for (const e of staticParallaxList) {
      // Compute progress scalar (0 ... 1.0) for element scroll
      // 0.0 -> top of element just reached bottom of viewport
      // 1.0 -> bottom of element just reached top of viewport
      const rect = e.element.getBoundingClientRect()
      const s = rect.bottom / (window.innerHeight + rect.height)
      // const yMove = (-(1-s) * shift)
      const yMove = (-(0.5-s) * e.shift)
      e.element.style['transform'] = 
        `translate(0px, ${yMove}${e.units})`
      //(-(1-s) * shift * rect.height) + 'px'
    }

  // animateParallax.lastScrollY = scrollY

  requestAnimationFrame(animateParallax)
}
