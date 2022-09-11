/**
 * Maintains a stack of functions which will be invoked (asynchronously,
 * sequentially) when .process() is called. Each function may be registered
 * with a corresponding pattern object, and will only be called for inputs
 * which match its pattern object.
 */
 export class Conveyor {
    stack = []
    patterns = new WeakMap

    async process (...input) {

        let halt = false
        const end = () => { halt = true }

        for (const f of this.stack) {

            let skip = false
            // If a pattern has been specified,
            // and any of the inputs fail to match the pattern,
            // then skip this element of the function stack.
            if (this.patterns.has(f)) {
                // Treat empty input as a pattern mismatch
                if (input.length === 0) {
                    skip = true
                }

                let pat = this.patterns.get(f)
                for (const i of input) {
                    if ( !patternMatch(pat, i) ) {
                        skip = true
                        break
                    }
                }
            }

            if (skip)
                continue

            await f.call(this, ...input, end)

            if (halt)
                return
        }
    }

    /**
     * Add a function and, optionally, its pattern object to this Conveyor's
     * stack. When process(input) is invoked, all added functions will be
     * invoked if their pattern object matches the input, or if they did not
     * specify a pattern object. The process will be terminated early if any
     * function invokes end(), which is passed as a final parameter to each
     * function.
     * @param {Object} [pattern] An object specifying the pattern of input
     * which this function is meant to process. use({ x: 1 }, f) will only
     * invoke f() for inputs containing a property x = 1. Passing { x: '*' }
     * is interpreted as a wildcard match for the mere existence of property x.
     * Passing { x: undefined } is interpreted to mean that property x
     * should NOT be present in the input object(s).
     * @param {function} f The function to potentially invoke when process(z)
     * is called on the Conveyor. f will receive a final function argument,
     * 'end', which may be used to terminate this iteration of process().
     * @returns {Conveyor} this, allowing fluent calls.
     */
    use (pattern, f) {
        if (f) {
            this.patterns.set(f, pattern)
        } else {
            f = pattern
        }
        this.stack.push(f)
        return this
    }

    init (f) {
        f.call(this)
        return this
    }
}

// Check whether an object contains the same fields and values as
// a pattern object. Shallow comparison; only checks direct reference
// equality of sub-objects.
// Treats '*' string values in the pattern as wildcards.
// property: undefined indicates that the property must not exist
// in the target object.
function patternMatch (pattern, obj) {
    if (typeof pattern !== 'object') {
        return pattern === obj
    }

    for (const key of Reflect.ownKeys(pattern)) {
        
        // Ensure specifically undefined properties are NOT in the object
        if (pattern[key] === undefined) {
            if(key in obj){
                return false
            } else {
                continue
            }
        }

        // Ensure the pattern key is in the object.
        if ( !(key in obj) )
            return false

        // Accept wildcards
        if (pattern[key] === '*')
            continue

        // Apply regular expressions
        if (pattern[key] instanceof RegExp
            && pattern[key].test(obj[key]))
            continue

        // Check equality of non-wildcard values
        if (pattern[key] !== obj[key])
            return false
    }

    return true
}
