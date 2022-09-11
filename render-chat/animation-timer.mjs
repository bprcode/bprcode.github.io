function identityEaser () { return x => x }
function exponentEaser (exponent) { return x => x**exponent }
function functionProductEaser (f, g) { return x => f(x) * g(x) }
function pullAndReleaseEaser (a = 2, p = 0.7) { return x => x**p * (a*x + 1 - a) }
function bounceThriceEaser () { return x => {
// For a readable graph, see:
// https://www.desmos.com/calculator/qh7ecstcfg
    if (x < 0.4518)
        return 4.9*x**2
    if (x < 0.8357)
        return 4.9*x**2 - 6.3094*x + 2.85
    return 4.9*x**2 - 8.9891*x + 5.09
}}
function easeInOut () { return x => {
    if (x < 0.5)
        return 2*x**2
    return 1 - (-2*x + 2)**2 / 2
}}
function easeOutQuintic () { return x => 1 - (1 - x)**5 }
export function reverseEaser (original) { return x => 1 - original(1 - x) }

export const easers = {
    linear: x => x,
    square: exponentEaser(2),
    pull: pullAndReleaseEaser(),
    bounce: bounceThriceEaser(),
    in: exponentEaser(4),
    out: easeOutQuintic(),
    inOut: easeInOut()
}

/**
 * Begins animating with requestAnimationFrame(), using the timing
 *  transformation easer if provided, invoking the updater
 *  callback each frame.
 * @param {function} updater Callback function to draw each frame; receives
 *  a transformed scalar in the range [0, 1.0] representing progress through the
 *  animation and, optionally, an untransformed copy of the scalar as the
 *  second parameter.
 * @param {number} [duration] duration of the animation, in seconds
 * @param {function} [easer] Callback to transform [0, 1.0] timing values
 * @returns {Watcher} live object where .currentFrame is the last animation
 *  frame requested.
 */
export function startAnimation (updater, duration = 1.0, easer = identityEaser()) {
    let t0
    duration *= 1000 // seconds -> milliseconds
    let watcher = new Watcher()

    watcher.currentFrame = requestAnimationFrame(function stepFrame(t) {
        t0 ??= t
        let s = Math.min( (t - t0) / duration, 1.0 )

        if (s < 1.0)
            watcher.currentFrame = requestAnimationFrame(stepFrame)

        updater(easer(s), s)
    })

    return watcher
}

/**
 * Temporarily creates an animated canvas graph showing the behavior of an
 *  easing function.
 * @param {number} duration Length of animation in seconds
 * @param {function} [easer] Easing function (examples available,
 *  e.g. easers.inOut)
 * @returns {watcher} live object containing .currentFrame, the identifier from
 *  the latest requestAnimationFrame step for this animation, and an .elements
 *  array with the two canvases used for graphing.
 */
export function showAnimationTimer (duration = 1.0, easer = identityEaser()) {
    const canvasSize = 300
    const origin = { x: canvasSize * 0.1, y: canvasSize * 0.8 }
    const endpoint = { x : canvasSize * 0.9, y: canvasSize * 0.1}

    let canvas = document.createElement('canvas')
    let graphCanvas = document.createElement('canvas')
    let graphCtx = graphCanvas.getContext('2d')

    setTimeout(() => canvas.remove(), duration * 1000)
    canvas.style.background = `#333f`
    canvas.style.position = 'fixed'
    canvas.width = canvasSize
    canvas.height = canvasSize
    canvas.style.zIndex = -2
    canvas.style.boxShadow = '5px 5px 5px #4448'
    document.body.append(canvas)
    let ctx = canvas.getContext('2d')
    
    graphCanvas.width = canvasSize
    graphCanvas.height = canvasSize
    graphCanvas.style.zIndex = -1
    graphCanvas.style.position = 'fixed'
    document.body.append(graphCanvas)
    setTimeout(() => graphCanvas.remove(), duration * 1000)

    function drawVertical (x) {
        x = snapPixelAlignment(x, ctx.lineWidth)
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvasSize)
        ctx.stroke()
    }
    function drawHorizontal (y) {
        y = snapPixelAlignment(y, ctx.lineWidth)
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvasSize, y)
        ctx.stroke()
    }

    function drawCross (x, y) {
        drawVertical(x)
        drawHorizontal(y)
    }

    /**
     * Correct for pixel misalignment of canvas drawing operations.
     * @param {number} coordinate The coordinate at which to draw
     * @param {number} width The width of the stroke style
     * @returns {number} corrected pixel position.
     */
    function snapPixelAlignment (coordinate, width) {
        return width / 2 + parseInt(coordinate - width/2)
    }


    function drawGrid(steps) {
        let stepSize = Math.abs((endpoint.x - origin.x) / steps)
        // Draw forward
        for (let x = origin.x + stepSize;
                x < canvasSize;
                x += stepSize) {
            drawVertical(x)
        }
        // Draw backward
        for (let x = origin.x - stepSize;
                x > 0;
                x -= stepSize) {
            drawVertical(x)
        }

        // Switch to y
        stepSize = Math.abs((endpoint.y - origin.y) / steps)
        // Draw forward
        for (let y = origin.y + stepSize;
                y < canvasSize;
                y += stepSize) {
            drawHorizontal(y)
        }
        // Draw backward
        for (let y = origin.y - stepSize;
                y > 0;
                y -= stepSize) {
            drawHorizontal(y)
        }
    }
    ctx.lineWidth = 1.0
    ctx.strokeStyle = '#555f'
    drawGrid(5)
    ctx.lineWidth = 2.0
    ctx.strokeStyle = '#faaf'
    drawCross(endpoint.x - 2, endpoint.y - 2)
    ctx.strokeStyle = '#afaf'
    drawCross(origin.x - 2, origin.y - 2)

    const dx = endpoint.x - origin.x
    const dy = endpoint.y - origin.y
    let lastX = origin.x
    let lastY = origin.y

    ctx.lineWidth = 8.0
    ctx.strokeStyle = '#aaff'

    graphCtx.strokeStyle = '#aaff'
    graphCtx.lineWidth = 3.0
    graphCtx.lineJoin = 'round'
    graphCtx.fillStyle = '#adff'

    let graphPath = new Path2D()
    graphPath.moveTo(origin.x, origin.y)

    const watcher = startAnimation((scalar, rawProgress) => {

        lastX = origin.x + dx * rawProgress
        lastY = origin.y + dy * scalar
        
        // Re-paint the graph path
        graphCtx.clearRect(0, 0, canvasSize, canvasSize)
        graphPath.lineTo(lastX, lastY)
        graphCtx.stroke(graphPath)
        //
        
        // Draw current position dot
        graphCtx.beginPath()
        graphCtx.moveTo(lastX, lastY)
        graphCtx.fillStyle = '#eeff'
        graphCtx.arc(lastX, lastY, 5, 0, Math.PI * 2)
        graphCtx.fill()

    }, duration, easer)

    watcher.elements = [ canvas, graphCanvas ]
    return watcher
}

class Watcher {
    elements = null
    currentFrame = null

    cancel () {
        if (this.elements)
            for (const e of this.elements)
                e.remove()

        this.elements = null
        cancelAnimationFrame(this.currentFrame)
        this.currentFrame = null
    }
}
