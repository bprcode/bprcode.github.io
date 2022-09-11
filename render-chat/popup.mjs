import { startAnimation, easers } from './animation-timer.mjs'

/**
 * Represents a floating pop-up box, styled with the page's .popup class
 * and rendered with a template function (if specified).
 */
export class Popup {
    template
    data
    element = null
    moveListener = null
    currentlyAnimating = false
    animationWatcher = false
    trackingPaused = false
    cssClass = 'popup'
    x = 0
    y = 0

    constructor (options = {}) {
        options = {
            template: null,
            data: null,
            cssClass: 'popup',
            ...options
        }
        Object.assign(this, options)
        this.create()
    }

    trackCursor () {
        this.untrackCursor()
        
        this.moveListener = event => {
            this.moveTo(event.clientX, event.clientY)
        }

        window.addEventListener('mousemove', this.moveListener)
    }

    untrackCursor () {
        if (this.moveListener)
            window.removeEventListener('mousemove', this.moveListener)
    }

    moveTo (x, y, duration = 0.0, easer = easers.linear) {

        // Do not animate for over-60-FPS movements.
        if (duration < 0.017) {
            this.x = x
            this.y = y
            this.element.style.transform = `translate(${this.x}px, ${this.y}px)`
            this.stayInBounds()
            return
        }
        
        // Otherwise, animate.
        this.targetX = x
        this.targetY = y
        
        if ( ! this.currentlyAnimating ) {
            this.currentlyAnimating = true

            let lastS = 0

            this.animationWatcher = startAnimation((s,t) => {

                if (t > 0.999) {
                    this.currentlyAnimating = false
                    this.moveTo(this.targetX, this.targetY)
                    this.animationWatcher.cancel()
                    return
                }

                // Scale the animation proportionally to handle moving targets.
                let dx = this.targetX - this.x
                let dy = this.targetY - this.y

                // Don't chase if already atop the target.
                if (dx**2 + dy**2 < 1.0) {
                    return
                }

                let ds = s - lastS
                lastS = s

                dx = dx * ds / (1-s)
                dy = dy * ds / (1-s)

                // cap maximum step size.
                if (dx > 200) { dx = 200 }
                if (dx < -200) { dx = -200 }
                if (dy > 200) { dy = 200 }
                if (dy < -200) { dy = -200 }
                
                this.x += dx
                this.y += dy
                
                this.element.style.transform = `translate(${this.x}px, ${this.y}px)`
                this.stayInBounds()

            }, duration, easer)
        }
    }

    stayInBounds () {
        let bounds = document.body.getBoundingClientRect()
        let r = this.element.getBoundingClientRect()

        if (r.right > bounds.width)
            this.x = (bounds.width - r.width)
        if (r.bottom > bounds.height)
            this.y = (bounds.height - r.height)
        if (r.left < 0)
            this.x = 0
        if (r.top < 0 )
            this.y = 0

        this.element.style.transform = `translate(${this.x}px, ${this.y}px)`
    }

    show () {
        this.element.style.visibility = 'visible'
    }

    hide () {
        this.element.style.visibility = 'hidden'
    }

    create () {
        this.delete()   // Remove previous data if necessary
        let div = document.createElement('div')

        if (this.template) {
            div.innerHTML = this.template(this.data)
            div.classList.add(this.cssClass)
        }
        else {
            div.textContent = `Default Popup`
            div.classList.add(this.cssClass)
        }

        this.element = div
        this.applyStyle(this.element)

        document.body.append(this.element)
    }
    delete () {
        this.untrackCursor()

        if (this.element)
            this.element.remove()
    }

    applyStyle (element) {
        // Skip this step if the page already defines a popup style.
        if (cssClassDefined(this.cssClass))
            return

        element.style.position = 'absolute'
        element.style.background = '#eee'
        element.style.boxShadow = '5px 5px 5px #0048'
        element.style.width = '200px'
        element.style.height = '100px'
    }
}

function cssClassDefined (className) {
    className = '.' + className
    for (const css of document.styleSheets)
    {
        try {
            for (const rule of css.cssRules) {
                if (rule.selectorText === className)
                    return true
            }
        } catch (er) {
            // silently continue checking the other stylesheets
        }
    }
    return false
}
