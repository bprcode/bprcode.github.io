'use strict';
// Copyright © 2023 Bryan Rauen.
// All rights reserved. https://bprcode.github.io/

import { beginClarityTransition, setGrabStyle, logError, animationSet,
  shuffleUpcoming, beginFadeIn } from "./tesseract-controller.js"

const log = console.log.bind(console)
const el = document.getElementById.bind(document)
const select = document.querySelector.bind(document)
const all = document.querySelectorAll.bind(document)

console.warn('debug -- n.b. canvas disappears if shrunk to literally zero')
console.warn('debug -- add close box, add fallback behavior for Safari/non dvh height issue')
console.warn('debug -- Safari not registering click transitions between pages consistently')
console.warn('debug -- cloud texture burn / Safari + ember iris?')

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
  let theaterMode = false

  beginFadeIn(3000)

  buildAnimationList()
  updateContainerBounds()
  const links = all('.link-box a')
  underline.style['right'] = bounds.right - links[links.length - 1]
    .getBoundingClientRect().right + 'px'

  // Apply initial input states:
  setGrabStyle(select('input[name="grab-type"]:checked').value)

  // Add settings pane listeners:
  select('.grab-style').addEventListener('input', event => {
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
  for (const clickable of
    [select('.gear'), ...all('.link-box')]) {

    clickable.addEventListener('click', event => {
      const shineAnimationTime = 1100
      const selector = clickable.dataset.section
      const section = select('.' + selector)
      const shineContainer = section.querySelector('.shine-container')

      section.classList.remove('concealed')
      section.classList.add('opaque')
      section.scrollTop = 0

      if (shineContainer) {
        shineContainer.classList.add('display-block')
        setTimeout(() => {
          shineContainer.classList.remove('display-block')
        }, shineAnimationTime)
      }

      for (const c of all('.content')) {
        if (!c.classList.contains(selector)) {
          c.classList.remove('opaque')
          c.classList.add('concealed')
        }
      }

      glint(section.querySelector('.shine'))

      // Blur the tesseract rendering to improve text overlay legibility:
      beginClarityTransition(0, 500)
    })

    clickable.addEventListener('pointerenter', event => {
      select('.underline').classList.add('bright-underline')
    })

    clickable.addEventListener('pointerleave', event => {
      select('.underline').classList.remove('bright-underline')
    })
  }

  function closeAllPanes () {
    for (const e of all('.content')) {
      e.classList.remove('opaque')
      e.classList.add('concealed')
    }

    for (const e of all('.shine')) {
      e.classList.remove('shine-reveal')
    }

    // Restore the rendering clarity factor to its normal value:
    beginClarityTransition(1, 1500)
  }

  // Handle close button clicks
  for (const button of all('.close')) {
    button.addEventListener('click', closeAllPanes)
  }

  document.body.addEventListener('click', event => {
    // WARNING: If this listener is removed, older versions of Safari
    // will display a number of bugs, including pathological layout
    // rendering and a failure of other click event listeners.
  })

  // Close content panes upon any click outside of relevant areas:
  window.addEventListener('click', event => {
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
      || select('.gear').contains(event.target)) {
      const q =
        select('.' + event.target.dataset.section
                                + ' .shine')
      // Respond by playing a glint animation
      glint(q)
      return
    }

    closeAllPanes()
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

  // Toggle theater mode on click:
  select('.fullscreen').addEventListener('click', event => {
    theaterMode = !theaterMode
    applyFullscreen(theaterMode)
    // In case the platform does not support fullscreen,
    // directly apply the theater mode classes:
    applyTheater(theaterMode)
  })

  function applyFullscreen (activate) {
    if (activate) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen()

      } else if (document.documentElement.webkitRequestFullscreen) {
        document.documentElement.webkitRequestFullscreen()
      }

    } else {
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen()

      } else if (document.webkitCancelFullScreen) {
        document.webkitCancelFullScreen()
      }
    }
  }

  function applyTheater (activate) {
    if (activate) {
      select('.name-container').classList.add('fade-out')
      select('.link-box-container').classList.add('fade-out')
      select('.gear').classList.add('mostly-hidden')
      select('.fullscreen').classList.add('mostly-hidden')

    } else {
      select('.name-container').classList.remove('fade-out')
      select('.link-box-container').classList.remove('fade-out')
      select('.gear').classList.remove('mostly-hidden')
      select('.fullscreen').classList.remove('mostly-hidden')
    }
  }

  function handleFullscreenChange () {
    if (document.fullscreenElement) { theaterMode = true }
    else { theaterMode = false }
    applyTheater(document.fullscreenElement)
  }

  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
}

function buildAnimationList () {
  if (!animationSet.length) {
    logError('Animation data not yet available.')
    return
  }
  
  const ul = select('.ul-animations')
  for (const a of animationSet) {
    const li = document.createElement('li')
    const label = document.createElement('label')
    const checkbox = document.createElement('input')

    checkbox.type = 'checkbox'
    checkbox.checked = true
    checkbox.dataset.title = a.title
    checkbox.addEventListener('input', updateAnimationPreferences)

    label.append(checkbox)
    label.append(a.title)
    li.append(label)
    ul.append(li)
  }
}

function updateAnimationPreferences () {
  const checkboxes = all('.ul-animations input[type="checkbox"]')

  // Ensure at least one animation is selected:
  let count = 0
  for (const b of checkboxes) {
    if (b.checked) { count++ }
  }
  if (count === 0) { this.checked = true }

  // Update the active animation list:
  for (const c of checkboxes) {
    animationSet.find(a => a.title === c.dataset.title)
      .active = c.checked
  }

  shuffleUpcoming()
}
