'use strict';
// Copyright © 2023 Bryan Rauen.
// All rights reserved. https://bprcode.github.io/

const log = console.log.bind(console)
const el = document.getElementById.bind(document)
const all = document.querySelectorAll.bind(document)

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize)
} else {
  queueMicrotask(initialize)
}

function initialize () {
  const underline = document.querySelector('.underline')
  let leftBound =
    document.querySelector('footer').getBoundingClientRect().left
  let rightBound =
    document.querySelector('footer').getBoundingClientRect().right
  let lastMove = 'left'

  for (const link of all('.line-link')) {
    link.addEventListener('pointerenter', event => {
      underline.classList.remove('no-delay')

      if (event.target.getBoundingClientRect().left - leftBound
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
        event.target.getBoundingClientRect().left - leftBound + 'px'

      underline.style.right =
        rightBound - event.target.getBoundingClientRect().right + 'px'
    })
  }

  document.querySelector('footer').addEventListener('pointerleave', () => {
    underline.classList.remove('delay-left')
    underline.classList.remove('delay-right')
    underline.classList.add('no-delay')

    if (lastMove === 'left') {
      underline.style.right = underline.getBoundingClientRect().left + 'px'
    } else {
      underline.style.left = underline.getBoundingClientRect().right + 'px'
    }
  })

  window.addEventListener('resize', () => {
    leftBound =
      document.querySelector('footer').getBoundingClientRect().left
    rightBound =
      document.querySelector('footer').getBoundingClientRect().right

    underline.classList.remove('delay-right')
    underline.classList.remove('delay-left')
    underline.classList.add('no-delay')
    underline.style.left = rightBound + 'px'
    underline.style.right = rightBound + 'px'
  })

  // Single-page link responses
  for (const e of all('.line-link')) {
    e.addEventListener('click', event => {
      const target = event.target.dataset.target
      document.querySelector('.' + target).classList.remove('transparent')
      document.querySelector('.' + target).classList.add('opaque')

      for (const e of all('.content')) {
        if (!e.classList.contains(target)) {
        e.classList.remove('opaque')
        e.classList.add('transparent')
        }
      }
    })
  }

  // Close content when clicking outside
  document.body.addEventListener('click', event => {
    // Check whether the click was within a content section:
    for (const e of all('.content')) {
      if (e.contains(event.target) || e === event.target) {
        // Click was within content, do not close.
        return
      }
    }

    // Do not close content when clicking a same-page link:
    if (event.target.classList.contains('line-link')) {
      return
    }

    for (const e of all('.content')) {
      e.classList.remove('opaque')
      e.classList.add('transparent')
    }
  })
}
