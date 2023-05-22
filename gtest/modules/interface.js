'use strict';
// Copyright © 2023 Bryan Rauen.
// All rights reserved. https://bprcode.github.io/

import { beginClarityTransition, setGrabStyle }
  from "./tesseract-controller.js"

const log = console.log.bind(console)
const el = document.getElementById.bind(document)
const select = document.querySelector.bind(document)
const all = document.querySelectorAll.bind(document)

console.warn('debug -- check for pixel-off underline in Chrome mobile on link click')
console.warn('debug -- occasional cloud opacity issue? Possibly resize-related? Or just a weird moment in a transition?')
console.warn('debug -- n.b. canvas disappears if shrunk to literally zero')
console.warn('debug -- clicking outside of grid does not trigger click event')

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize)
} else {
  queueMicrotask(initialize)
}

function initialize () {
  const underline = select('.underline')
  let lastMove = 'left'
  let bounds = { left: 0, right: 0, top: 0, bottom: 0 }
  let lastHoveredBox = select('.link-box')

  updateContainerBounds()
  const links = all('.link-box a')
  underline.style['right'] = bounds.right - links[links.length - 1]
    .getBoundingClientRect().right + 'px'

  setGrabStyle(select('input[name="grab-type"]:checked').value)

  // Settings pane listeners:
  select('.grab-style').addEventListener('input', event => {
    log(event.target.value)
    setGrabStyle(event.target.value)
  })

  // Underline animation control:
  for (const box of all('.link-box')) {
    box.addEventListener('pointerenter', event => {
      const anchor = box.querySelector('.line-link')
      lastHoveredBox = box

      underline.classList.remove('no-delay')

      if (anchor.getBoundingClientRect().left - bounds.left
            < parseFloat(getComputedStyle(underline).left)) {
        underline.classList.remove('delay-left')
        underline.classList.add('delay-right')
        lastMove = 'left'
      } else {
        underline.classList.remove('delay-right')
        underline.classList.add('delay-left')
        lastMove = 'right'
      }

      underline.style.left =
        anchor.getBoundingClientRect().left - bounds.left + 'px'

      underline.style.right =
        bounds.right - anchor.getBoundingClientRect().right + 'px'
    })
  }

  select('.link-box-container')
    .addEventListener('pointerleave', () => {
    underline.classList.remove('delay-left')
    underline.classList.remove('delay-right')
    underline.classList.add('no-delay')

    if (lastMove === 'left') {
      underline.style.right = bounds.right
        - lastHoveredBox.querySelector('a')
          .getBoundingClientRect().left + 'px'
    } else {
      underline.style.left =
        lastHoveredBox.querySelector('a')
          .getBoundingClientRect().right - bounds.left + 'px'
    }
  })

  function updateContainerBounds () {
    bounds = select('.link-box-container')
      .getBoundingClientRect()
  }

  function ejectUnderline () {
    const links = all('.link-box a')

    underline.classList.remove('delay-right')
    underline.classList.remove('delay-left')
    underline.classList.add('no-delay')
    underline.style.left = '100%'
    underline.style['right'] = bounds.right - links[links.length - 1]
      .getBoundingClientRect().right + 'px'
  }

  window.addEventListener('resize', () => {
    updateContainerBounds()
    ejectUnderline()
  })

  // Single-page link reactions:
  for (const box of [...all('.link-box'), select('.hamburger')]) {
    box.addEventListener('click', event => {
      const shineAnimationTime = 1100
      const section = box.dataset.section
      const content = select('.' + section)
      const shineContainer = content.querySelector('.shine-container')

      content.classList.remove('concealed')
      content.classList.add('opaque')
      content.scrollTop = 0

      if (shineContainer) {
        shineContainer.classList.add('display-block')
        setTimeout(() => {
          shineContainer.classList.remove('display-block')
        }, shineAnimationTime)
      }

      for (const c of all('.content')) {
        if (!c.classList.contains(section)) {
          c.classList.remove('opaque')
          c.classList.add('concealed')
        }
      }

      glint(content.querySelector('.shine'))

      // Blur the tesseract rendering to improve text overlay legibility:
      beginClarityTransition(0, 1000)
    })

    box.addEventListener('pointerenter', event => {
      select('.underline').classList.add('bright-underline')
    })

    box.addEventListener('pointerleave', event => {
      select('.underline').classList.remove('bright-underline')
    })
  }

  // Close content panes upon any click outside of relevant areas:
  document.body.addEventListener('click', event => {
    // Check whether the click was within a content section:
    for (const e of all('.content')) {
      if (e.contains(event.target) || e === event.target) {
        // Click was within content, do not close.
        return
      }
    }

    // Do not close content when clicking a same-page link:
    if (event.target.classList.contains('link-box')
      || event.target.classList.contains('line-link')
      || select('.hamburger').contains(event.target)) {
      const q =
        select('.' + event.target.dataset.section
                                + ' .shine')
      // Respond by playing a glint animation
      glint(q)
      return
    }

    for (const e of all('.content')) {
      e.classList.remove('opaque')
      e.classList.add('concealed')
    }

    for (const e of all('.shine')) {
      e.classList.remove('shine-reveal')
    }

    // Restore the rendering clarity factor to its normal value:
    beginClarityTransition(1, 1000)
  })

  let glintLockout = false
  function glint (shinyElement) {
    if (!shinyElement) { return }
    if (glintLockout) { return }
    glintLockout = true
    setTimeout(() => {
      glintLockout = false
    }, 1000)

    for (const e of all('.shine')) {
      e.classList.remove('shine-reveal')
    }

    setTimeout(() => {
      shinyElement.classList.add('shine-reveal')
    }, 200)
  }
}
