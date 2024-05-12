'use strict';
// Copyright © 2023 Bryan Rauen.
// All rights reserved. https://bprcode.github.io/

import { beginClarityTransition, setGrabStyle, logError, animationSet,
  shuffleUpcoming, beginFadeIn } from "./tesseract-controller.js"

const select = document.querySelector.bind(document)
const all = document.querySelectorAll.bind(document)

initialize()
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

  // Prevent same-page links from triggering an address bar pop-up on Safari:
  for (const link of all('.line-link')) {
    link.addEventListener('click', event => {
      event.preventDefault()
    })
  }

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

      const selector = clickable.dataset.section
      const section = select('.' + selector)

      // Just close the pane if it's already open:
      if(section.classList.contains('opaque')){
        return closeAllPanes()
      }

      section.classList.remove('concealed')
      section.classList.add('opaque')
      section.scrollTop = 0
            
      for (const c of all('.content')) {
        if (!c.classList.contains(selector)) {
          c.classList.remove('opaque')
          c.classList.add('concealed')
        }
      }

      glint(section)

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
      
      return
    }

    closeAllPanes()
  })

  function glint(target) {
    glint.duration ??= 1100
    glint.canvas ??= document.querySelector('.glint-canvas')
    glint.ctx ??= glint.canvas.getContext('2d')

    const bounds = target.getBoundingClientRect()
    glint.canvas.style.width = bounds.width + 'px'
    glint.canvas.style.height = bounds.height + 'px'
    glint.canvas.style.top = bounds.top + 'px'

    clearTimeout(glint.tid)
    glint.canvas.style.display = 'block'
    glint.tid = setTimeout(
      () => glint.canvas.style.display = 'none', glint.duration)
      
    delete glintFrame.t0
    requestAnimationFrame(glintFrame)
  }

  function glintFrame(t) {
    if(!glint.ctx.createConicGradient) {
      return
    }
  
    const size = 80

    glintFrame.t0 ??= t
    const dt = Math.min((t - glintFrame.t0)/glint.duration, 1)

    const eased = 1 - (1 - dt)**2
    const alpha = 1 - dt**3

    const theta = -eased * Math.PI * 2 - Math.PI / 2
    const gradient = glint.ctx.createConicGradient(
      theta, -0.4 * size, 1.5 * size)
     
    gradient.addColorStop(0, `hsla(22, 100%, 59%, ${alpha*0.02})`)
    gradient.addColorStop(0.29, `hsla(22, 100%, 59%, ${alpha*0.125})`)
    gradient.addColorStop(0.34, `hsla(353, 88%, 63%, ${alpha*0.314})`)
    gradient.addColorStop(0.45, `hsla(8, 100%, 67%, ${alpha*0.376})`)
    gradient.addColorStop(0.48, `hsla(26, 100%, 65%, ${alpha*0.439})`)
    gradient.addColorStop(0.50, `hsla(26, 100%, 70%, ${alpha*0.565})`)
    gradient.addColorStop(0.72, `hsla(151, 51%, 51%, ${alpha*0.376})`)
    gradient.addColorStop(0.875, `hsla(198, 57%, 49%, ${alpha*0.251})`)
    gradient.addColorStop(1, `hsla(198, 57%, 49%, ${alpha*0.02})`)
  
    glint.ctx.clearRect(0, 0, size, size);
    glint.ctx.fillStyle = gradient;
    glint.ctx.fillRect(0, 0, size, size);
  
    if(dt < 1) {
      requestAnimationFrame(glintFrame)
    }
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
      if (document.exitFullscreen) {
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
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      theaterMode = true;
    }
    else {
      theaterMode = false;
    }

    applyTheater(theaterMode)
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
